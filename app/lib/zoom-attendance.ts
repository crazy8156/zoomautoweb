import { createHmac, timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { normalizeEmail } from './email';
import { supabaseAdmin } from './supabase-admin';

type ZoomWebhookEnvelope = {
  event?: string;
  event_id?: string;
  payload?: {
    account_id?: string;
    object?: Record<string, unknown>;
    plainToken?: string;
    plain_token?: string;
  };
};

type ZoomSessionLookup = {
  id: string;
  course_id: string;
  start_time: string;
  courses:
    | {
        duration_minutes: number | null;
        title: string;
      }
    | {
        duration_minutes: number | null;
        title: string;
      }[]
    | null;
};

type ZoomAttendanceRow = {
  id: string;
  session_id: string | null;
  course_id: string | null;
  zoom_meeting_id: string;
  participant_key: string;
  student_id: string | null;
  email: string | null;
  participant_name: string | null;
  zoom_participant_id: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration_minutes: number;
  attendance_status: string;
  auto_deducted_at: string | null;
  last_event_at: string | null;
};

type StudentLookup = {
  id: string;
  email: string;
  name: string;
};

const LATE_THRESHOLD_MINUTES = 10;
const EARLY_LEAVE_THRESHOLD_MINUTES = 10;

function firstItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toTaipeiDateKey(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function getWebhookSecret() {
  return process.env.ZOOM_WEBHOOK_SECRET_TOKEN || process.env.ZOOM_SECRET_TOKEN || '';
}

function signZoomWebhook(message: string) {
  return createHmac('sha256', getWebhookSecret()).update(message).digest('hex');
}

function compareSafe(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getMeetingIdFromPayload(object: Record<string, unknown>) {
  const id = object.id ?? object.meeting_id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  if (typeof id === 'string' && id.trim()) return id.trim();
  return '';
}

function getParticipantObject(object: Record<string, unknown>) {
  const candidate = object.participant;
  return candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
}

function getParticipantName(participant: Record<string, unknown>) {
  const nameCandidate = participant.user_name ?? participant.participant_user_name ?? participant.name;
  return typeof nameCandidate === 'string' ? nameCandidate.trim() : '';
}

function getParticipantEmail(participant: Record<string, unknown>) {
  const emailCandidate = participant.email ?? participant.user_email ?? participant.participant_user_email;
  return typeof emailCandidate === 'string' ? normalizeEmail(emailCandidate) : '';
}

function getParticipantKey(email: string, participantName: string) {
  if (email) return email;
  const normalizedName = participantName.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalizedName ? `name:${normalizedName}` : 'anonymous';
}

function getParticipantEventTime(participant: Record<string, unknown>, object: Record<string, unknown>) {
  const value =
    participant.join_time ??
    participant.leave_time ??
    object.start_time ??
    object.end_time ??
    object.last_start_time ??
    null;

  return typeof value === 'string' ? value : null;
}

function revalidateZoomAttendancePaths() {
  revalidatePath('/admin/sessions');
  revalidatePath('/admin/students');
  revalidatePath('/admin/bookings');
  revalidatePath('/student');
  revalidatePath('/student/course-center');
  revalidatePath('/my-bookings');
}

export function verifyZoomWebhookSignature(rawBody: string, headers: Headers) {
  const secret = getWebhookSecret();
  if (!secret) return true;

  const signature = headers.get('x-zm-signature');
  const timestamp = headers.get('x-zm-request-timestamp');

  if (!signature || !timestamp) {
    return true;
  }

  const message = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${signZoomWebhook(message)}`;
  return compareSafe(signature, expected);
}

export function buildZoomWebhookValidationResponse(payload: ZoomWebhookEnvelope) {
  const plainToken =
    payload.payload?.plainToken ||
    payload.payload?.plain_token ||
    (typeof (payload as { plainToken?: string }).plainToken === 'string' ? (payload as { plainToken?: string }).plainToken : '') ||
    '';

  return {
    plainToken,
    encryptedToken: signZoomWebhook(plainToken),
  };
}

async function findStudentByEmail(email: string): Promise<StudentLookup | null> {
  if (!email) return null;
  const { data, error } = await supabaseAdmin.from('students').select('id,name,email').eq('email', email).maybeSingle();
  if (error) {
    throw new Error(`查詢學生 Email 對應失敗：${error.message}`);
  }
  if (!data?.id) return null;

  return {
    id: data.id,
    email: String(data.email ?? ''),
    name: String(data.name ?? ''),
  };
}

async function findSessionForMeeting(meetingId: string, occurredAt: string | null) {
  const numericMeetingId = Number(meetingId);
  if (!Number.isFinite(numericMeetingId)) return null;

  const { data, error } = await supabaseAdmin
    .from('course_sessions')
    .select('id,course_id,start_time,courses:course_id(duration_minutes,title)')
    .eq('zoom_meeting_id', numericMeetingId)
    .order('start_time', { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`查詢課程場次失敗：${error.message}`);
  }

  const sessions = (data ?? []) as ZoomSessionLookup[];
  if (sessions.length === 0) return null;
  if (!occurredAt) return sessions[0];

  const targetDateKey = toTaipeiDateKey(occurredAt);
  const sameDaySessions = sessions.filter((session) => toTaipeiDateKey(session.start_time) === targetDateKey);
  const sessionPool = sameDaySessions.length > 0 ? sameDaySessions : sessions;
  const targetTime = new Date(occurredAt).getTime();

  return sessionPool
    .map((session) => ({
      session,
      diff: Math.abs(new Date(session.start_time).getTime() - targetTime),
    }))
    .sort((left, right) => left.diff - right.diff)[0]?.session ?? sessions[0];
}

async function recordWebhookEvent({
  event,
  eventId,
  meetingId,
  sessionId,
  payload,
}: {
  event: string;
  eventId?: string;
  meetingId?: string;
  sessionId?: string | null;
  payload: unknown;
}) {
  const { error } = await supabaseAdmin.from('zoom_webhook_events').insert({
    zoom_event: event,
    zoom_event_id: eventId ?? null,
    zoom_meeting_id: meetingId ?? null,
    session_id: sessionId ?? null,
    payload,
  });

  if (error) {
    throw new Error(`寫入 Zoom webhook 紀錄失敗：${error.message}`);
  }
}

async function loadAttendanceRow(meetingId: string, sessionId: string | null, participantKey: string) {
  const query = supabaseAdmin
    .from('zoom_session_attendance')
    .select(
      'id,session_id,course_id,zoom_meeting_id,participant_key,student_id,email,participant_name,zoom_participant_id,join_time,leave_time,duration_minutes,attendance_status,auto_deducted_at,last_event_at',
    )
    .eq('zoom_meeting_id', meetingId)
    .eq('participant_key', participantKey);

  const { data, error } = sessionId ? await query.eq('session_id', sessionId).maybeSingle() : await query.is('session_id', null).maybeSingle();

  if (error) {
    throw new Error(`讀取出席資料失敗：${error.message}`);
  }

  return (data ?? null) as ZoomAttendanceRow | null;
}

async function upsertAttendanceRow({
  meetingId,
  session,
  student,
  participantName,
  participantEmail,
  zoomParticipantId,
  joinTime,
  leaveTime,
  status,
}: {
  meetingId: string;
  session: ZoomSessionLookup | null;
  student: StudentLookup | null;
  participantName: string;
  participantEmail: string;
  zoomParticipantId?: string | null;
  joinTime?: string | null;
  leaveTime?: string | null;
  status?: string;
}) {
  const participantKey = getParticipantKey(participantEmail, participantName);
  const existingRow = await loadAttendanceRow(meetingId, session?.id ?? null, participantKey);
  const nextJoinTime = existingRow?.join_time ?? joinTime ?? null;
  const nextLeaveTime = leaveTime ?? existingRow?.leave_time ?? null;
  const durationMinutes =
    nextJoinTime && nextLeaveTime
      ? Math.max(Math.round((new Date(nextLeaveTime).getTime() - new Date(nextJoinTime).getTime()) / (1000 * 60)), 0)
      : existingRow?.duration_minutes ?? 0;

  const row = {
    id: existingRow?.id,
    session_id: session?.id ?? null,
    course_id: session?.course_id ?? null,
    zoom_meeting_id: meetingId,
    participant_key: participantKey,
    student_id: student?.id ?? existingRow?.student_id ?? null,
    email: participantEmail || existingRow?.email || null,
    participant_name: participantName || existingRow?.participant_name || null,
    zoom_participant_id: zoomParticipantId || existingRow?.zoom_participant_id || null,
    join_time: nextJoinTime,
    leave_time: nextLeaveTime,
    duration_minutes: durationMinutes,
    attendance_status: status ?? existingRow?.attendance_status ?? 'registered',
    auto_deducted_at: existingRow?.auto_deducted_at ?? null,
    last_event_at: leaveTime ?? joinTime ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('zoom_session_attendance')
    .upsert(row, { onConflict: 'zoom_meeting_id,session_id,participant_key' })
    .select(
      'id,session_id,course_id,zoom_meeting_id,participant_key,student_id,email,participant_name,zoom_participant_id,join_time,leave_time,duration_minutes,attendance_status,auto_deducted_at,last_event_at',
    )
    .single();

  if (error) {
    throw new Error(`寫入出席資料失敗：${error.message}`);
  }

  return data as ZoomAttendanceRow;
}

function computeFinalAttendanceStatus({
  row,
  sessionStartTime,
  scheduledDurationMinutes,
}: {
  row: ZoomAttendanceRow;
  sessionStartTime: string;
  scheduledDurationMinutes: number;
}) {
  if (!row.join_time) return 'absent';

  const joinTime = new Date(row.join_time).getTime();
  const sessionStart = new Date(sessionStartTime).getTime();
  const scheduledEnd = sessionStart + scheduledDurationMinutes * 60 * 1000;
  const isLate = joinTime > sessionStart + LATE_THRESHOLD_MINUTES * 60 * 1000;
  const leftEarly =
    row.leave_time && scheduledDurationMinutes > EARLY_LEAVE_THRESHOLD_MINUTES
      ? new Date(row.leave_time).getTime() < scheduledEnd - EARLY_LEAVE_THRESHOLD_MINUTES * 60 * 1000
      : false;

  if (row.duration_minutes > 0 && row.duration_minutes < 10) {
    return 'left_early';
  }
  if (isLate) return 'late';
  if (leftEarly) return 'left_early';
  return 'attended';
}

async function updateBookingStatus(sessionId: string, studentId: string | null, status: string) {
  if (!studentId) return;
  const { error } = await supabaseAdmin.from('bookings').update({ status }).eq('session_id', sessionId).eq('student_id', studentId);
  if (error) {
    throw new Error(`更新預約狀態失敗：${error.message}`);
  }
}

async function autoDeductLesson(row: ZoomAttendanceRow) {
  if (!row.student_id || !row.course_id || row.auto_deducted_at) return null;

  const { data: enrollment, error: enrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .select('id,remaining_lessons')
    .eq('student_id', row.student_id)
    .eq('course_id', row.course_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (enrollmentError) {
    throw new Error(`讀取學生堂數失敗：${enrollmentError.message}`);
  }
  if (!enrollment?.id) return null;

  const nextRemainingLessons = Math.max(Number(enrollment.remaining_lessons ?? 0) - 1, 0);
  const now = new Date().toISOString();

  const { error: updateEnrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .update({ remaining_lessons: nextRemainingLessons })
    .eq('id', enrollment.id);

  if (updateEnrollmentError) {
    throw new Error(`自動扣堂失敗：${updateEnrollmentError.message}`);
  }

  const { error: updateAttendanceError } = await supabaseAdmin
    .from('zoom_session_attendance')
    .update({ auto_deducted_at: now, updated_at: now })
    .eq('id', row.id);

  if (updateAttendanceError) {
    throw new Error(`寫入自動扣堂紀錄失敗：${updateAttendanceError.message}`);
  }

  return now;
}

export async function handleZoomParticipantJoined(envelope: ZoomWebhookEnvelope) {
  const event = envelope.event ?? 'meeting.participant_joined';
  const object = (envelope.payload?.object ?? {}) as Record<string, unknown>;
  const participant = getParticipantObject(object);
  const meetingId = getMeetingIdFromPayload(object);
  const participantEmail = getParticipantEmail(participant);
  const participantName = getParticipantName(participant);
  const eventTime = getParticipantEventTime(participant, object);
  const zoomParticipantId = typeof (participant.id ?? participant.participant_id) === 'string' ? String(participant.id ?? participant.participant_id) : null;

  const session = await findSessionForMeeting(meetingId, eventTime);
  const student = await findStudentByEmail(participantEmail);

  await upsertAttendanceRow({
    meetingId,
    session,
    student,
    participantName,
    participantEmail,
    zoomParticipantId,
    joinTime: eventTime,
    status: 'live',
  });

  await recordWebhookEvent({
    event,
    eventId: envelope.event_id,
    meetingId,
    sessionId: session?.id ?? null,
    payload: envelope,
  });

  revalidateZoomAttendancePaths();
}

export async function handleZoomParticipantLeft(envelope: ZoomWebhookEnvelope) {
  const event = envelope.event ?? 'meeting.participant_left';
  const object = (envelope.payload?.object ?? {}) as Record<string, unknown>;
  const participant = getParticipantObject(object);
  const meetingId = getMeetingIdFromPayload(object);
  const participantEmail = getParticipantEmail(participant);
  const participantName = getParticipantName(participant);
  const eventTime = getParticipantEventTime(participant, object);
  const zoomParticipantId = typeof (participant.id ?? participant.participant_id) === 'string' ? String(participant.id ?? participant.participant_id) : null;

  const session = await findSessionForMeeting(meetingId, eventTime);
  const student = await findStudentByEmail(participantEmail);

  await upsertAttendanceRow({
    meetingId,
    session,
    student,
    participantName,
    participantEmail,
    zoomParticipantId,
    leaveTime: eventTime,
    status: 'attended',
  });

  await recordWebhookEvent({
    event,
    eventId: envelope.event_id,
    meetingId,
    sessionId: session?.id ?? null,
    payload: envelope,
  });

  revalidateZoomAttendancePaths();
}

export async function finalizeZoomMeetingAttendance(envelope: ZoomWebhookEnvelope) {
  const event = envelope.event ?? 'meeting.ended';
  const object = (envelope.payload?.object ?? {}) as Record<string, unknown>;
  const meetingId = getMeetingIdFromPayload(object);
  const occurredAt =
    (typeof object.end_time === 'string' ? object.end_time : null) ||
    (typeof object.start_time === 'string' ? object.start_time : null) ||
    new Date().toISOString();

  const session = await findSessionForMeeting(meetingId, occurredAt);
  await recordWebhookEvent({
    event,
    eventId: envelope.event_id,
    meetingId,
    sessionId: session?.id ?? null,
    payload: envelope,
  });

  if (!session?.id) {
    revalidateZoomAttendancePaths();
    return;
  }

  const course = firstItem(session.courses);
  const scheduledDurationMinutes = Number(course?.duration_minutes ?? 60) || 60;

  const [inviteesResult, registrantsResult, existingAttendanceResult] = await Promise.all([
    supabaseAdmin.from('zoom_meeting_invitees').select('email').eq('zoom_meeting_id', meetingId),
    supabaseAdmin.from('zoom_meeting_registrants').select('email,student_id,first_name,last_name').eq('zoom_meeting_id', meetingId),
    supabaseAdmin
      .from('zoom_session_attendance')
      .select(
        'id,session_id,course_id,zoom_meeting_id,participant_key,student_id,email,participant_name,zoom_participant_id,join_time,leave_time,duration_minutes,attendance_status,auto_deducted_at,last_event_at',
      )
      .eq('zoom_meeting_id', meetingId)
      .eq('session_id', session.id),
  ]);

  if (inviteesResult.error) {
    throw new Error(`讀取 Zoom 受邀者失敗：${inviteesResult.error.message}`);
  }
  if (registrantsResult.error) {
    throw new Error(`讀取 Zoom registrants 失敗：${registrantsResult.error.message}`);
  }
  if (existingAttendanceResult.error) {
    throw new Error(`讀取現有出席資料失敗：${existingAttendanceResult.error.message}`);
  }

  const existingRows = (existingAttendanceResult.data ?? []) as ZoomAttendanceRow[];
  const existingEmailSet = new Set(existingRows.map((row) => normalizeEmail(row.email)));
  const expectedParticipants = Array.from(
    new Set(
      [...(inviteesResult.data ?? []).map((row) => normalizeEmail(String(row.email ?? ''))), ...(registrantsResult.data ?? []).map((row) => normalizeEmail(String(row.email ?? '')))].filter(Boolean),
    ),
  );

  for (const email of expectedParticipants) {
    if (existingEmailSet.has(email)) continue;
    const student = await findStudentByEmail(email);
    const registrantRow = (registrantsResult.data ?? []).find((row) => normalizeEmail(String(row.email ?? '')) === email);
    const registrantName = `${String(registrantRow?.first_name ?? '').trim()} ${String(registrantRow?.last_name ?? '').trim()}`.trim();

    await upsertAttendanceRow({
      meetingId,
      session,
      student,
      participantName: registrantName,
      participantEmail: email,
      status: 'absent',
    });
  }

  const { data: finalRowsData, error: finalRowsError } = await supabaseAdmin
    .from('zoom_session_attendance')
    .select(
      'id,session_id,course_id,zoom_meeting_id,participant_key,student_id,email,participant_name,zoom_participant_id,join_time,leave_time,duration_minutes,attendance_status,auto_deducted_at,last_event_at',
    )
    .eq('zoom_meeting_id', meetingId)
    .eq('session_id', session.id);

  if (finalRowsError) {
    throw new Error(`重新讀取出席資料失敗：${finalRowsError.message}`);
  }

  const finalRows = (finalRowsData ?? []) as ZoomAttendanceRow[];
  for (const row of finalRows) {
    const finalStatus = computeFinalAttendanceStatus({
      row,
      sessionStartTime: session.start_time,
      scheduledDurationMinutes,
    });

    const { error: updateAttendanceError } = await supabaseAdmin
      .from('zoom_session_attendance')
      .update({
        attendance_status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (updateAttendanceError) {
      throw new Error(`更新出席狀態失敗：${updateAttendanceError.message}`);
    }

    await updateBookingStatus(session.id, row.student_id, finalStatus);
    if (finalStatus === 'attended' || finalStatus === 'late' || finalStatus === 'left_early') {
      await autoDeductLesson(row);
    }
  }

  revalidateZoomAttendancePaths();
}
