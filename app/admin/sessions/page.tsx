import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ConfirmSubmitButton } from '../../components/confirm-submit-button';
import { requireAdminSession } from '../../lib/admin';
import { findOrCreateCourseByTitle } from '../../lib/course-admin';
import { CourseSession, firstItem, formatDateTime } from '../../lib/domain';
import { parseInviteeEmails } from '../../lib/email';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { deleteZoomMeeting, getZoomMeetingById, listZoomMeetingRegistrants, listZoomMeetings, updateZoomMeeting } from '../../lib/zoom';

type SearchParams = {
  date?: string;
  month?: string;
  zoomPage?: string;
};

const ZOOM_PAGE_SIZE = 5;

type ZoomCalendarItem = {
  uid: string;
  meetingId: number;
  topic?: string;
  start_time?: string;
  join_url?: string;
  hostEmail?: string;
  courseTitles: string[];
  guestEmails: string[];
  guestLabels: string[];
};

type BookingEmailRow = {
  session_id: string;
  student_id: string;
};

type StoredInviteeRow = {
  zoom_meeting_id: string;
  email: string;
};

type StoredRegistrantRow = {
  zoom_meeting_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
};

type StudentEmailRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type AttendanceRow = {
  session_id: string | null;
  attendance_status: string;
  participant_name: string | null;
  email: string | null;
};

type ZoomRegistrantSummary = {
  email: string;
  label: string;
};

const SELF_HOST_EMAIL = 'carolyn120450975@gmail.com';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function parseMonthKey(monthKey: string | undefined) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  return { year, monthIndex: month - 1 };
}

function parseDateKey(dateKey: string | undefined, fallback: Date) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return toDateKey(fallback);
  return dateKey;
}

function toTaipeiDateKey(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    if (year && month && day) return `${year}-${month}-${day}`;
  }
  return value.length >= 10 ? value.slice(0, 10) : '';
}

function uniqueEmails(emails: string[]) {
  return Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function filterGuestEmails(emails: string[], hostEmail?: string) {
  const excluded = new Set([SELF_HOST_EMAIL, hostEmail?.trim().toLowerCase() ?? ''].filter(Boolean));
  return uniqueEmails(emails).filter((email) => !excluded.has(email));
}

function uniqueText(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function buildGuestLabelsFromEmails(emails: string[], studentByEmail: Map<string, { name: string; email: string }>) {
  return uniqueText(
    emails.map((email) => {
      const student = studentByEmail.get(email);
      if (!student) return email;
      return student.name ? `${student.name} (${student.email})` : student.email;
    }),
  );
}

function normalizeRegistrantList(registrants: { email?: string; first_name?: string; last_name?: string }[]) {
  return registrants
    .map((registrant) => {
      const email = String(registrant.email ?? '').trim().toLowerCase();
      if (!email) return null;
      const name = `${String(registrant.first_name ?? '').trim()} ${String(registrant.last_name ?? '').trim()}`.trim();
      return {
        email,
        label: name ? `${name} (${email})` : email,
      } satisfies ZoomRegistrantSummary;
    })
    .filter((item): item is ZoomRegistrantSummary => Boolean(item));
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

async function upsertStoredInvitees(meetingId: number, inviteeEmails: string[]) {
  if (inviteeEmails.length === 0) return;

  const { error } = await supabaseAdmin
    .from('zoom_meeting_invitees')
    .upsert(
      inviteeEmails.map((email) => ({
        zoom_meeting_id: String(meetingId),
        email,
      })),
      { onConflict: 'zoom_meeting_id,email' },
    );

  if (error) {
    throw new Error(`儲存受邀者 Email 失敗：${error.message}`);
  }
}

async function syncMeetingSessions({
  courseId,
  meetingId,
  joinUrl,
  fallbackStartTime,
}: {
  courseId: string;
  meetingId: number;
  joinUrl: string;
  fallbackStartTime: string;
}) {
  const detail = await getZoomMeetingById(meetingId);
  const occurrences = detail?.occurrences?.filter((item) => (item.status ?? 'available') !== 'deleted') ?? [];
  const startTimes = occurrences.length > 0 ? occurrences.map((item) => item.start_time ?? fallbackStartTime) : [detail?.start_time ?? fallbackStartTime];

  for (const startTime of startTimes.filter(Boolean)) {
    const { data: existingSession, error: existingSessionError } = await supabaseAdmin
      .from('course_sessions')
      .select('id')
      .eq('zoom_meeting_id', meetingId)
      .eq('start_time', startTime)
      .maybeSingle();

    if (existingSessionError) {
      throw new Error(`查詢既有場次失敗：${existingSessionError.message}`);
    }

    if (existingSession?.id) {
      const { error: updateSessionError } = await supabaseAdmin
        .from('course_sessions')
        .update({
          course_id: courseId,
          zoom_join_url: joinUrl,
        })
        .eq('id', existingSession.id);

      if (updateSessionError) {
        throw new Error(`更新既有場次失敗：${updateSessionError.message}`);
      }

      continue;
    }

    const { error: insertSessionError } = await supabaseAdmin.from('course_sessions').insert({
      course_id: courseId,
      start_time: startTime,
      zoom_join_url: joinUrl,
      zoom_meeting_id: meetingId,
    });

    if (insertSessionError) {
      throw new Error(`建立場次失敗：${insertSessionError.message}`);
    }
  }
}

function revalidateZoomPaths() {
  revalidatePath('/admin');
  revalidatePath('/admin/course-center');
  revalidatePath('/admin/courses');
  revalidatePath('/admin/sessions');
  revalidatePath('/admin/students');
  revalidatePath('/student');
  revalidatePath('/student/course-center');
}

async function syncZoomMeetingAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  const meetingId = Number(formData.get('meetingId') ?? 0);
  const courseName = String(formData.get('courseName') ?? '').trim();
  const joinUrl = String(formData.get('joinUrl') ?? '').trim();
  const fallbackStartTime = String(formData.get('startTime') ?? '').trim();
  const inviteeEmails = parseInviteeEmails(String(formData.get('inviteeEmails') ?? ''));

  if (!Number.isFinite(meetingId) || meetingId <= 0) {
    throw new Error('找不到有效的 Zoom 會議 ID。');
  }

  if (!courseName) {
    throw new Error('請輸入要綁定的課程名稱。');
  }

  if (!fallbackStartTime) {
    throw new Error('找不到會議開始時間，無法同步。');
  }

  const { id: courseId } = await findOrCreateCourseByTitle(courseName);
  await syncMeetingSessions({
    courseId,
    meetingId,
    joinUrl,
    fallbackStartTime,
  });
  await upsertStoredInvitees(meetingId, inviteeEmails);
  revalidateZoomPaths();
}

async function deleteZoomMeetingAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  const meetingId = Number(formData.get('meetingId') ?? 0);
  if (!Number.isFinite(meetingId) || meetingId <= 0) {
    throw new Error('找不到有效的 Zoom 會議 ID。');
  }

  await deleteZoomMeeting(meetingId);

  const normalizedMeetingId = String(meetingId);
  const { error: deleteSessionsError } = await supabaseAdmin.from('course_sessions').delete().eq('zoom_meeting_id', meetingId);
  if (deleteSessionsError) {
    throw new Error(`刪除場次資料失敗：${deleteSessionsError.message}`);
  }

  const { error: deleteInviteesError } = await supabaseAdmin.from('zoom_meeting_invitees').delete().eq('zoom_meeting_id', normalizedMeetingId);
  if (deleteInviteesError) {
    throw new Error(`刪除受邀者資料失敗：${deleteInviteesError.message}`);
  }

  const { error: deleteRegistrantsError } = await supabaseAdmin.from('zoom_meeting_registrants').delete().eq('zoom_meeting_id', normalizedMeetingId);
  if (deleteRegistrantsError) {
    throw new Error(`刪除 Zoom 註冊資料失敗：${deleteRegistrantsError.message}`);
  }

  revalidateZoomPaths();
}

async function updateZoomMeetingAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  const meetingId = Number(formData.get('meetingId') ?? 0);
  const topic = String(formData.get('topic') ?? '').trim();
  const startTime = String(formData.get('startTime') ?? '').trim();
  const durationMinutes = Number(formData.get('durationMinutes') ?? 60);
  const agenda = String(formData.get('agenda') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const waitingRoom = formData.get('waitingRoom') === 'on';
  const joinBeforeHost = formData.get('joinBeforeHost') === 'on';
  const muteUponEntry = formData.get('muteUponEntry') === 'on';
  const hostVideo = String(formData.get('hostVideo') ?? 'off') === 'on';
  const participantVideo = String(formData.get('participantVideo') ?? 'off') === 'on';
  const autoRecordingRaw = String(formData.get('autoRecording') ?? 'none');
  const autoRecording = autoRecordingRaw === 'local' || autoRecordingRaw === 'cloud' ? autoRecordingRaw : 'none';
  const audioRaw = String(formData.get('audio') ?? 'voip');
  const audio = audioRaw === 'telephony' || audioRaw === 'both' ? audioRaw : 'voip';

  if (!Number.isFinite(meetingId) || meetingId <= 0) {
    throw new Error('找不到有效的 Zoom 會議 ID。');
  }
  if (!topic || !startTime || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('請完整填寫主題、開始時間與時長。');
  }

  await updateZoomMeeting({
    meetingId,
    topic,
    startTime,
    durationMinutes,
    agenda: agenda || undefined,
    password: password || undefined,
    waitingRoom,
    joinBeforeHost,
    muteUponEntry,
    hostVideo,
    participantVideo,
    autoRecording,
    audio,
  });

  const { error: updateSessionsError } = await supabaseAdmin
    .from('course_sessions')
    .update({
      start_time: startTime,
    })
    .eq('zoom_meeting_id', meetingId);

  if (updateSessionsError) {
    throw new Error(`更新平台場次時間失敗：${updateSessionsError.message}`);
  }

  revalidateZoomPaths();
}

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();

  const { date, month, zoomPage } = await searchParams;
  const { year, monthIndex } = parseMonthKey(month);
  const monthDate = new Date(year, monthIndex, 1);
  const selectedDate = parseDateKey(date, new Date());
  const monthKey = toMonthKey(monthDate);
  const yearStart = `${year}-01-01`;
  const monthEndDate = new Date(year, monthIndex + 1, 0);
  const yearEnd = `${year}-12-31`;

  const { data } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,zoom_join_url,zoom_meeting_id,courses:course_id(title,duration_minutes,price)')
    .gte('start_time', `${yearStart}T00:00:00`)
    .lte('start_time', `${yearEnd}T23:59:59`)
    .order('start_time', { ascending: true })
    .limit(5000);

  const yearSessions = (data ?? []) as CourseSession[];
  const yearSessionIds = Array.from(new Set(yearSessions.map((session) => session.id).filter(Boolean)));
  const { data: bookingEmailData } = yearSessionIds.length
    ? await supabase.from('bookings').select('session_id,student_id').in('session_id', yearSessionIds)
    : { data: [] };
  const bookingRows = (bookingEmailData ?? []) as BookingEmailRow[];
  const studentIds = Array.from(new Set(bookingRows.map((row) => row.student_id).filter(Boolean)));
  const { data: studentEmailData } = studentIds.length
    ? await supabase.from('students').select('id,name,email').in('id', studentIds)
    : { data: [] };
  const studentRows = (studentEmailData ?? []) as StudentEmailRow[];
  const studentMap = new Map(
    studentRows
      .filter((row) => typeof row.email === 'string' && row.email)
      .map((row) => [
        row.id,
        {
          name: String(row.name ?? '').trim(),
          email: String(row.email).trim().toLowerCase(),
        },
      ]),
  );
  const studentByEmail = new Map(
    studentRows
      .filter((row) => typeof row.email === 'string' && row.email)
      .map((row) => {
        const email = String(row.email).trim().toLowerCase();
        const name = String(row.name ?? '').trim();
        return [email, { name, email }] as const;
      }),
  );
  const guestEmailsBySessionId = new Map<string, string[]>();
  const guestLabelsBySessionId = new Map<string, string[]>();
  bookingRows.forEach((row) => {
    const student = studentMap.get(row.student_id);
    if (!student) return;
    const current = guestEmailsBySessionId.get(row.session_id) ?? [];
    guestEmailsBySessionId.set(row.session_id, uniqueEmails([...current, student.email]));
    const label = student.name ? `${student.name} (${student.email})` : student.email;
    const currentLabels = guestLabelsBySessionId.get(row.session_id) ?? [];
    guestLabelsBySessionId.set(row.session_id, uniqueText([...currentLabels, label]));
  });
  const guestEmailsByMeetingDateKey = new Map<string, string[]>();
  const guestLabelsByMeetingDateKey = new Map<string, string[]>();
  const courseTitlesByMeetingDateKey = new Map<string, string[]>();
  yearSessions.forEach((session) => {
    const meetingId = String(session.zoom_meeting_id ?? '');
    const dateKey = toTaipeiDateKey(session.start_time);
    if (!meetingId || !dateKey) return;
    const meetingKey = `${meetingId}#${dateKey}`;
    const current = guestEmailsByMeetingDateKey.get(meetingKey) ?? [];
    const sessionEmails = guestEmailsBySessionId.get(session.id) ?? [];
    guestEmailsByMeetingDateKey.set(meetingKey, uniqueEmails([...current, ...sessionEmails]));
    const currentLabels = guestLabelsByMeetingDateKey.get(meetingKey) ?? [];
    const sessionLabels = guestLabelsBySessionId.get(session.id) ?? [];
    guestLabelsByMeetingDateKey.set(meetingKey, uniqueText([...currentLabels, ...sessionLabels]));
    const currentCourseTitles = courseTitlesByMeetingDateKey.get(meetingKey) ?? [];
    const courseTitle = firstItem(session.courses)?.title ?? '';
    courseTitlesByMeetingDateKey.set(meetingKey, uniqueText([...currentCourseTitles, courseTitle]));
  });
  const sessions = yearSessions.filter((session) => {
    return toTaipeiDateKey(session.start_time) === selectedDate;
  });
  const sessionIdsForSelectedDate = sessions.map((session) => session.id).filter(Boolean);
  const attendanceResult = sessionIdsForSelectedDate.length
    ? await supabaseAdmin
        .from('zoom_session_attendance')
        .select('session_id,attendance_status,participant_name,email')
        .in('session_id', sessionIdsForSelectedDate)
    : { data: [], error: null };
  if (attendanceResult.error) {
    throw new Error(`讀取出席摘要失敗：${attendanceResult.error.message}`);
  }
  const attendanceRows = (attendanceResult.data ?? []) as AttendanceRow[];
  const attendanceSummaryBySessionId = new Map<
    string,
    {
      attended: number;
      absent: number;
      late: number;
      leftEarly: number;
      labels: string[];
    }
  >();
  attendanceRows.forEach((row) => {
    if (!row.session_id) return;
    const current = attendanceSummaryBySessionId.get(row.session_id) ?? {
      attended: 0,
      absent: 0,
      late: 0,
      leftEarly: 0,
      labels: [],
    };
    if (row.attendance_status === 'attended') current.attended += 1;
    if (row.attendance_status === 'absent') current.absent += 1;
    if (row.attendance_status === 'late') current.late += 1;
    if (row.attendance_status === 'left_early') current.leftEarly += 1;
    const labelBase = row.participant_name || row.email || '';
    if (labelBase && !current.labels.includes(labelBase)) current.labels.push(labelBase);
    attendanceSummaryBySessionId.set(row.session_id, current);
  });
  const daysWithSession = new Set(
    yearSessions
      .map((session) => toTaipeiDateKey(session.start_time))
      .filter(Boolean),
  );
  let zoomMeetings: Awaited<ReturnType<typeof listZoomMeetings>> = [];
  let zoomLoadError = '';
  let zoomLoadHint = '';

  try {
    zoomMeetings = await listZoomMeetings();
  } catch (error) {
    const message = error instanceof Error ? error.message : '無法抓取 Zoom 會議資料';
    const needsListScope = message.includes('meeting:read:list_meetings');

    if (!needsListScope) {
      zoomLoadError = message;
    } else {
      const uniqueMeetingIds = Array.from(new Set(sessions.map((session) => session.zoom_meeting_id).filter((id): id is string => Boolean(id))));
      if (uniqueMeetingIds.length === 0) {
        zoomLoadHint = '目前尚未建立任何場次資料；建立第一筆場次後，這裡就會顯示可讀取會議。';
      } else {
        const detailResults = await Promise.all(uniqueMeetingIds.map((meetingId) => getZoomMeetingById(meetingId)));
        zoomMeetings = detailResults.filter((item): item is NonNullable<typeof item> => Boolean(item));
        if (zoomMeetings.length === 0) {
          zoomLoadHint = '缺少 list_meetings scope，且現有場次的會議目前無法讀取。';
        }
      }
    }
  }

  const storedInviteeMeetingIds = Array.from(
    new Set([
      ...yearSessions.map((session) => String(session.zoom_meeting_id ?? '')).filter(Boolean),
      ...zoomMeetings.map((meeting) => String(meeting.id ?? '')).filter(Boolean),
    ]),
  );
  const { data: storedInviteeData } = storedInviteeMeetingIds.length
    ? await supabaseAdmin.from('zoom_meeting_invitees').select('zoom_meeting_id,email').in('zoom_meeting_id', storedInviteeMeetingIds)
    : { data: [] };
  const { data: storedRegistrantData } = storedInviteeMeetingIds.length
    ? await supabaseAdmin
        .from('zoom_meeting_registrants')
        .select('zoom_meeting_id,email,first_name,last_name,student_id')
        .in('zoom_meeting_id', storedInviteeMeetingIds)
    : { data: [] };
  const storedInviteeRows = (storedInviteeData ?? []) as StoredInviteeRow[];
  const storedRegistrantRows = (storedRegistrantData ?? []) as StoredRegistrantRow[];
  const storedInviteesByMeetingId = new Map<string, string[]>();
  storedInviteeRows.forEach((row) => {
    const current = storedInviteesByMeetingId.get(row.zoom_meeting_id) ?? [];
    storedInviteesByMeetingId.set(row.zoom_meeting_id, uniqueEmails([...current, row.email]));
  });
  const storedRegistrantEmailsByMeetingId = new Map<string, string[]>();
  const storedRegistrantLabelsByMeetingId = new Map<string, string[]>();
  storedRegistrantRows.forEach((row) => {
    const normalizedEmail = String(row.email ?? '').trim().toLowerCase();
    if (!normalizedEmail) return;

    const currentEmails = storedRegistrantEmailsByMeetingId.get(row.zoom_meeting_id) ?? [];
    storedRegistrantEmailsByMeetingId.set(row.zoom_meeting_id, uniqueEmails([...currentEmails, normalizedEmail]));

    const student = row.student_id ? studentMap.get(row.student_id) : null;
    const fullName = [String(row.first_name ?? '').trim(), String(row.last_name ?? '').trim()].filter(Boolean).join(' ').trim();
    const label = student?.name
      ? `${student.name} (${student.email})`
      : fullName
        ? `${fullName} (${normalizedEmail})`
        : normalizedEmail;
    const currentLabels = storedRegistrantLabelsByMeetingId.get(row.zoom_meeting_id) ?? [];
    storedRegistrantLabelsByMeetingId.set(row.zoom_meeting_id, uniqueText([...currentLabels, label]));
  });

  const expandedZoomMeetings: ZoomCalendarItem[] = [];
  const [meetingDetails, meetingRegistrants] = await Promise.all([
    mapWithConcurrency(zoomMeetings, 4, (meeting) => getZoomMeetingById(meeting.id)),
    mapWithConcurrency(zoomMeetings, 2, (meeting) => listZoomMeetingRegistrants(meeting.id)),
  ]);

  for (const [index, meeting] of zoomMeetings.entries()) {
    const detail = meetingDetails[index];
    const registrants = normalizeRegistrantList(meetingRegistrants[index] ?? []);
    const occurrences = detail?.occurrences?.filter((item) => (item.status ?? 'available') !== 'deleted') ?? [];

    if (occurrences.length === 0) {
      expandedZoomMeetings.push({
        uid: `${meeting.id}`,
        meetingId: meeting.id,
        topic: meeting.topic,
        start_time: meeting.start_time,
        join_url: meeting.join_url,
        hostEmail: detail?.host_email ?? meeting.host_email,
        courseTitles: courseTitlesByMeetingDateKey.get(`${meeting.id}#${toTaipeiDateKey(meeting.start_time)}`) ?? [],
        guestEmails: filterGuestEmails(
          [
            ...(guestEmailsByMeetingDateKey.get(`${meeting.id}#${toTaipeiDateKey(meeting.start_time)}`) ?? []),
            ...(storedInviteesByMeetingId.get(String(meeting.id)) ?? []),
            ...(storedRegistrantEmailsByMeetingId.get(String(meeting.id)) ?? []),
            ...registrants.map((registrant) => registrant.email),
          ],
          detail?.host_email ?? meeting.host_email,
        ),
        guestLabels: uniqueText([
          ...(guestLabelsByMeetingDateKey.get(`${meeting.id}#${toTaipeiDateKey(meeting.start_time)}`) ?? []),
          ...(storedRegistrantLabelsByMeetingId.get(String(meeting.id)) ?? []),
          ...registrants.map((registrant) => registrant.label),
          ...buildGuestLabelsFromEmails(
            filterGuestEmails(storedInviteesByMeetingId.get(String(meeting.id)) ?? [], detail?.host_email ?? meeting.host_email),
            studentByEmail,
          ),
        ]),
      });
      continue;
    }

    occurrences.forEach((occurrence) => {
      const occurrenceStartTime = occurrence.start_time ?? meeting.start_time;
      expandedZoomMeetings.push({
        uid: `${meeting.id}-${occurrence.occurrence_id ?? occurrence.start_time ?? 'occurrence'}`,
        meetingId: meeting.id,
        topic: meeting.topic,
        start_time: occurrenceStartTime,
        join_url: meeting.join_url,
        hostEmail: detail?.host_email ?? meeting.host_email,
        courseTitles: courseTitlesByMeetingDateKey.get(`${meeting.id}#${toTaipeiDateKey(occurrenceStartTime)}`) ?? [],
        guestEmails: filterGuestEmails(
          [
            ...(guestEmailsByMeetingDateKey.get(`${meeting.id}#${toTaipeiDateKey(occurrenceStartTime)}`) ?? []),
            ...(storedInviteesByMeetingId.get(String(meeting.id)) ?? []),
            ...(storedRegistrantEmailsByMeetingId.get(String(meeting.id)) ?? []),
            ...registrants.map((registrant) => registrant.email),
          ],
          detail?.host_email ?? meeting.host_email,
        ),
        guestLabels: uniqueText([
          ...(guestLabelsByMeetingDateKey.get(`${meeting.id}#${toTaipeiDateKey(occurrenceStartTime)}`) ?? []),
          ...(storedRegistrantLabelsByMeetingId.get(String(meeting.id)) ?? []),
          ...registrants.map((registrant) => registrant.label),
          ...buildGuestLabelsFromEmails(
            filterGuestEmails(storedInviteesByMeetingId.get(String(meeting.id)) ?? [], detail?.host_email ?? meeting.host_email),
            studentByEmail,
          ),
        ]),
      });
    });
  }

  const zoomMeetingsForSelectedDate = expandedZoomMeetings.filter((meeting) => toTaipeiDateKey(meeting.start_time) === selectedDate);
  const daysWithMeeting = new Set(daysWithSession);
  expandedZoomMeetings.forEach((meeting) => {
    const dateKey = toTaipeiDateKey(meeting.start_time);
    if (dateKey.startsWith(monthKey)) daysWithMeeting.add(dateKey);
  });
  const syncedMeetingKeys = new Set(
    yearSessions
      .map((session) => {
        const meetingId = String(session.zoom_meeting_id ?? '');
        const dateKey = toTaipeiDateKey(session.start_time);
        if (!meetingId || !dateKey) return '';
        return `${meetingId}#${dateKey}`;
      })
      .filter(Boolean),
  );
  const unsyncedZoomMeetings = expandedZoomMeetings.filter((meeting) => {
    const dateKey = toTaipeiDateKey(meeting.start_time);
    if (!dateKey) return false;
    return !syncedMeetingKeys.has(`${meeting.meetingId}#${dateKey}`);
  });
  const unsyncedPreview = unsyncedZoomMeetings.slice(0, 20);
  const parsedZoomPage = Number(zoomPage ?? '1');
  const currentZoomPage = Number.isFinite(parsedZoomPage) && parsedZoomPage > 0 ? Math.floor(parsedZoomPage) : 1;
  const zoomTotalPages = Math.max(1, Math.ceil(expandedZoomMeetings.length / ZOOM_PAGE_SIZE));
  const safeZoomPage = Math.min(currentZoomPage, zoomTotalPages);
  const zoomFrom = (safeZoomPage - 1) * ZOOM_PAGE_SIZE;
  const zoomPageItems = expandedZoomMeetings.slice(zoomFrom, zoomFrom + ZOOM_PAGE_SIZE);
  const monthSessions = yearSessions.filter((session) => toTaipeiDateKey(session.start_time).startsWith(monthKey));

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef5ff_42%,#e7eefb_100%)] px-6 py-8 md:px-8 md:py-10'>
      <div className='mx-auto max-w-7xl'>
        <section className='rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>Zoom 日曆總覽</p>
              <h1 className='mt-3 font-["Plus_Jakarta_Sans"] text-4xl font-extrabold tracking-tight md:text-6xl'>Zoom 日曆</h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡會把平台內的課程場次、Zoom 官方會議、同步狀態、學生名單和出席摘要集中顯示，方便老師每天直接檢查。
              </p>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/admin/course-center'
                className='rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回老師後台管理
              </Link>
              <Link
                href='/admin/courses'
                className='rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'
              >
                新增 Zoom 課程
              </Link>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-4'>
            <MetricCard label='本月場次' value={`${monthSessions.length}`} />
            <MetricCard label='今日課程' value={`${sessions.length + zoomMeetingsForSelectedDate.length}`} />
            <MetricCard label='Zoom 近期會議' value={`${expandedZoomMeetings.length}`} />
            <MetricCard label='未同步會議' value={`${unsyncedZoomMeetings.length}`} />
          </div>
        </section>

        <section className='mt-8 rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>月曆檢視</p>
            <h2 className='mt-2 text-2xl font-black tracking-tight'>課程日曆</h2>
          </div>
          <div className='flex items-center gap-2 text-sm font-semibold'>
            <Link
              className='rounded-full border border-slate-200 px-4 py-2'
              href={`/admin/sessions?month=${toMonthKey(new Date(year, monthIndex - 1, 1))}&date=${selectedDate}`}
            >
              上個月
            </Link>
            <span className='rounded-full bg-slate-50 px-4 py-2 text-slate-700'>{year}/{pad2(monthIndex + 1)}</span>
            <Link
              className='rounded-full border border-slate-200 px-4 py-2'
              href={`/admin/sessions?month=${toMonthKey(new Date(year, monthIndex + 1, 1))}&date=${selectedDate}`}
            >
              下個月
            </Link>
          </div>
        </div>

        <div className='mt-5 grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500'>
          {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
            <div key={label} className='text-center'>
              {label}
            </div>
          ))}
        </div>

        <div className='mt-3 grid grid-cols-7 gap-2'>
          {Array.from({ length: new Date(year, monthIndex, 1).getDay() }).map((_, idx) => (
            <div key={`empty-${idx}`} className='h-14 rounded-2xl border border-transparent' />
          ))}
          {Array.from({ length: monthEndDate.getDate() }).map((_, idx) => {
            const day = idx + 1;
            const dateKey = `${monthKey}-${pad2(day)}`;
            const isSelected = dateKey === selectedDate;
            const hasSession = daysWithMeeting.has(dateKey);
            return (
              <Link
                key={dateKey}
                href={`/admin/sessions?month=${monthKey}&date=${dateKey}`}
                className={`flex h-14 items-center justify-center rounded-2xl border text-sm font-semibold transition-colors ${
                  isSelected ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span>{day}</span>
                {hasSession ? <span className='ml-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-500' /> : null}
              </Link>
            );
          })}
        </div>
        </section>

        <section className='mt-8 rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>當日清單</p>
            <h2 className='mt-2 text-2xl font-black tracking-tight'>當天課程清單（{selectedDate}）</h2>
          </div>
          <span className='rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700'>
            共 {sessions.length + zoomMeetingsForSelectedDate.length} 筆
          </span>
        </div>
        <div className='mt-6 grid gap-4'>
        {sessions.length === 0 && zoomMeetingsForSelectedDate.length === 0 ? (
          <div className='rounded-[1.5rem] border border-dashed border-slate-200 p-6 text-sm text-slate-600'>當天沒有課程。請點其他日期，或先到 Zoom 課程管理建立場次。</div>
        ) : (
          <>
              {sessions.map((session) => {
                const course = firstItem(session.courses);
                const storedInvitees = storedInviteesByMeetingId.get(String(session.zoom_meeting_id ?? '')) ?? [];
                const guestEmails = filterGuestEmails(
                  [...(guestEmailsBySessionId.get(session.id) ?? []), ...storedInvitees],
                  undefined,
                );
                const guestLabels = uniqueText([
                  ...(guestLabelsBySessionId.get(session.id) ?? []),
                  ...buildGuestLabelsFromEmails(guestEmails, studentByEmail),
                ]);
                const attendanceSummary = attendanceSummaryBySessionId.get(session.id);
                return (
                  <article key={session.id} className='rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <h2 className='text-lg font-semibold'>{course?.title ?? '未設定課程'}</h2>
                        <p className='mt-1 text-sm text-slate-600'>{formatDateTime(session.start_time)}</p>
                        <p className='mt-1 text-xs text-slate-500'>Meeting ID：{session.zoom_meeting_id ?? '未記錄'}</p>
                        <p className='mt-1 text-xs text-slate-500'>學生：{guestLabels.length > 0 ? guestLabels.join(' / ') : '查無資料'}</p>
                        <p className='mt-1 text-xs text-slate-500'>對方信箱：{guestEmails.length > 0 ? guestEmails.join(' / ') : '查無資料'}</p>
                        {attendanceSummary ? (
                          <p className='mt-1 text-xs text-slate-500'>
                            出席摘要：到課 {attendanceSummary.attended} / 遲到 {attendanceSummary.late} / 早退 {attendanceSummary.leftEarly} / 缺席 {attendanceSummary.absent}
                          </p>
                        ) : null}
                      </div>
                    <div className='flex flex-wrap gap-2'>
                      {session.zoom_join_url ? (
                        <a className='rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' href={session.zoom_join_url} target='_blank' rel='noreferrer'>
                          打開 Zoom
                        </a>
                      ) : (
                        <span className='rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600'>尚未建立 Zoom</span>
                      )}
                      {session.zoom_meeting_id ? (
                        <form action={deleteZoomMeetingAction}>
                          <input name='meetingId' type='hidden' value={String(session.zoom_meeting_id)} />
                          <ConfirmSubmitButton
                            className='rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600'
                            label='刪除整個 Zoom 會議'
                            message='這會刪除 Zoom 官方會議、相關場次與受邀者資料。若是定期會議，全部 occurrence 都會一起刪除。確定要繼續嗎？'
                          />
                        </form>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
            {sessions.length === 0
              ? zoomMeetingsForSelectedDate.map((meeting) => (
                  <article key={`zoom-${meeting.uid}`} className='rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <h2 className='text-lg font-semibold'>{meeting.topic ?? '未命名會議'}</h2>
                        <p className='mt-1 text-sm text-slate-600'>開始時間：{meeting.start_time ? formatDateTime(meeting.start_time) : '未提供'}</p>
                        <p className='mt-1 text-xs text-slate-500'>Meeting ID：{meeting.meetingId}</p>
                        <p className='mt-1 text-xs text-slate-500'>課程名稱：{meeting.courseTitles.length > 0 ? meeting.courseTitles.join(' / ') : meeting.topic ?? '查無資料'}</p>
                        <p className='mt-1 text-xs text-slate-500'>學生：{meeting.guestLabels.length > 0 ? meeting.guestLabels.join(' / ') : '查無資料'}</p>
                        <p className='mt-1 text-xs text-slate-500'>對方信箱：{meeting.guestEmails.length > 0 ? meeting.guestEmails.join(' / ') : '查無資料'}</p>
                      </div>
                      {meeting.join_url ? (
                        <a className='rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' href={meeting.join_url} target='_blank' rel='noreferrer'>
                          打開 Zoom
                        </a>
                      ) : (
                        <span className='rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600'>無連結</span>
                      )}
                    </div>
                    <form action={syncZoomMeetingAction} className='mt-4 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
                      <input name='meetingId' type='hidden' value={meeting.meetingId} />
                      <input name='joinUrl' type='hidden' value={meeting.join_url ?? ''} />
                      <input name='startTime' type='hidden' value={meeting.start_time ?? ''} />
                      <label className='text-sm font-semibold text-slate-700'>
                        綁定課程名稱
                        <input
                          className='mt-1 block w-full rounded border px-3 py-2 font-normal'
                          defaultValue={meeting.courseTitles[0] ?? meeting.topic ?? ''}
                          name='courseName'
                          required
                        />
                      </label>
                      <label className='text-sm font-semibold text-slate-700'>
                        受邀者 Email
                        <textarea
                          className='mt-1 block w-full rounded border px-3 py-2 font-normal'
                          defaultValue={meeting.guestEmails.join('\n')}
                          name='inviteeEmails'
                          rows={3}
                        />
                      </label>
                      <div className='flex flex-col justify-end gap-2'>
                        <button className='rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' type='submit'>
                          同步到課程日曆
                        </button>
                        <div className='text-xs text-slate-500'>會把這個 Zoom 會議的全部 occurrence 一起補進課程場次。</div>
                      </div>
                    </form>
                  </article>
                ))
              : null}
          </>
        )}
        </div>
        </section>

      <section className='mt-8 rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>近期會議</p>
            <h2 className='mt-2 text-2xl font-black tracking-tight'>Zoom 近期會議</h2>
          </div>
          <span className='rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700'>第 {safeZoomPage} / {zoomTotalPages} 頁</span>
        </div>
        <p className='mt-2 text-xs text-slate-500'>若未開放 list_meetings scope，系統會改由已建立場次的 Meeting ID 逐筆讀取。</p>
        {zoomLoadError ? (
          <p className='mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700'>讀取失敗：{zoomLoadError}</p>
        ) : zoomLoadHint ? (
          <p className='mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-700'>{zoomLoadHint}</p>
        ) : expandedZoomMeetings.length === 0 ? (
          <p className='mt-3 text-sm text-slate-600'>目前 Zoom 沒有 upcoming 會議。</p>
        ) : (
          <div className='mt-4 space-y-3'>
            {zoomPageItems.map((meeting) => (
              <article key={meeting.uid} className='rounded-[1.75rem] border border-slate-200 bg-white p-5'>
                <p className='text-base font-semibold'>{meeting.topic ?? '未命名會議'}</p>
                <p className='mt-1 text-sm text-slate-600'>開始時間：{meeting.start_time ? formatDateTime(meeting.start_time) : '未提供'}</p>
                <p className='mt-1 text-xs text-slate-500'>Meeting ID：{meeting.meetingId}</p>
                <p className='mt-1 text-xs text-slate-500'>課程名稱：{meeting.courseTitles.length > 0 ? meeting.courseTitles.join(' / ') : meeting.topic ?? '查無資料'}</p>
                <p className='mt-1 text-xs text-slate-500'>學生：{meeting.guestLabels.length > 0 ? meeting.guestLabels.join(' / ') : '查無資料'}</p>
                <p className='mt-1 text-xs text-slate-500'>對方信箱：{meeting.guestEmails.length > 0 ? meeting.guestEmails.join(' / ') : '查無資料'}</p>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {meeting.join_url ? (
                    <a className='inline-block rounded-full bg-slate-950 px-3 py-2 text-sm font-semibold text-white' href={meeting.join_url} target='_blank' rel='noreferrer'>
                      打開 Zoom 會議
                    </a>
                  ) : null}
                  <form action={deleteZoomMeetingAction}>
                    <input name='meetingId' type='hidden' value={meeting.meetingId} />
                    <ConfirmSubmitButton
                      className='rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600'
                      label='刪除會議'
                      message='這會刪除 Zoom 官方會議、相關場次與受邀者資料。若是定期會議，全部 occurrence 都會一起刪除。確定要繼續嗎？'
                    />
                  </form>
                </div>
                <details className='mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4'>
                  <summary className='cursor-pointer text-sm font-semibold text-slate-700'>編輯 Zoom 會議設定</summary>
                  <form action={updateZoomMeetingAction} className='mt-4 grid gap-3 md:grid-cols-2'>
                    <input name='meetingId' type='hidden' value={meeting.meetingId} />
                    <label className='text-sm font-semibold text-slate-700'>
                      會議主題
                      <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={meeting.topic ?? ''} name='topic' required />
                    </label>
                    <label className='text-sm font-semibold text-slate-700'>
                      開始時間
                      <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={meeting.start_time ?? ''} name='startTime' required type='datetime-local' />
                    </label>
                    <label className='text-sm font-semibold text-slate-700'>
                      單次時長（分鐘）
                      <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue='60' min='15' name='durationMinutes' required type='number' />
                    </label>
                    <label className='text-sm font-semibold text-slate-700'>
                      密碼
                      <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='password' />
                    </label>
                    <label className='text-sm font-semibold text-slate-700 md:col-span-2'>
                      說明
                      <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='agenda' rows={3} />
                    </label>
                    <label className='flex items-center justify-between rounded border bg-white px-3 py-2 text-sm font-semibold text-slate-700'>
                      啟用等候室
                      <input defaultChecked name='waitingRoom' type='checkbox' />
                    </label>
                    <label className='flex items-center justify-between rounded border bg-white px-3 py-2 text-sm font-semibold text-slate-700'>
                      允許主持人前加入
                      <input name='joinBeforeHost' type='checkbox' />
                    </label>
                    <label className='flex items-center justify-between rounded border bg-white px-3 py-2 text-sm font-semibold text-slate-700'>
                      入會即靜音
                      <input defaultChecked name='muteUponEntry' type='checkbox' />
                    </label>
                    <label className='text-sm font-semibold text-slate-700'>
                      音訊來源
                      <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue='voip' name='audio'>
                        <option value='voip'>電腦音訊</option>
                        <option value='telephony'>電話音訊</option>
                        <option value='both'>同時使用</option>
                      </select>
                    </label>
                    <label className='text-sm font-semibold text-slate-700'>
                      主持人視訊
                      <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue='off' name='hostVideo'>
                        <option value='off'>關閉</option>
                        <option value='on'>開啟</option>
                      </select>
                    </label>
                    <label className='text-sm font-semibold text-slate-700'>
                      學生視訊
                      <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue='off' name='participantVideo'>
                        <option value='off'>關閉</option>
                        <option value='on'>開啟</option>
                      </select>
                    </label>
                    <label className='text-sm font-semibold text-slate-700 md:col-span-2'>
                      自動錄影
                      <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue='none' name='autoRecording'>
                        <option value='none'>不錄影</option>
                        <option value='local'>本機錄影</option>
                        <option value='cloud'>雲端錄影</option>
                      </select>
                    </label>
                    <button className='rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white md:col-span-2' type='submit'>
                      儲存會議修改
                    </button>
                  </form>
                </details>
              </article>
            ))}
            <div className='mt-4 flex items-center justify-between text-sm'>
              <p className='text-slate-600'>
                第 {safeZoomPage} / {zoomTotalPages} 頁（共 {expandedZoomMeetings.length} 筆）
              </p>
              <div className='flex gap-2'>
                {safeZoomPage > 1 ? (
                  <Link
                    className='rounded-full border border-slate-200 px-4 py-2 font-semibold'
                    href={`/admin/sessions?month=${monthKey}&date=${selectedDate}&zoomPage=${safeZoomPage - 1}`}
                  >
                    上一頁
                  </Link>
                ) : (
                  <span className='rounded-full border border-slate-200 px-4 py-2 text-slate-400'>上一頁</span>
                )}
                {safeZoomPage < zoomTotalPages ? (
                  <Link
                    className='rounded-full border border-slate-200 px-4 py-2 font-semibold'
                    href={`/admin/sessions?month=${monthKey}&date=${selectedDate}&zoomPage=${safeZoomPage + 1}`}
                  >
                    下一頁
                  </Link>
                ) : (
                  <span className='rounded-full border border-slate-200 px-4 py-2 text-slate-400'>下一頁</span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className='mt-8 rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8'>
        <div>
          <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>未同步會議</p>
          <h2 className='mt-2 text-2xl font-black tracking-tight'>官方列表逐筆比對</h2>
        </div>
        <p className='mt-2 text-xs text-slate-500'>下方是 Zoom 官方清單存在，但目前還沒同步到日曆資料表的會議。</p>
        <p className='mt-3 text-sm text-slate-700'>未同步數量：{unsyncedZoomMeetings.length}</p>
        {unsyncedPreview.length === 0 ? (
          <p className='mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>目前沒有未同步會議。</p>
        ) : (
          <div className='mt-4 space-y-3'>
            {unsyncedPreview.map((meeting) => (
              <article key={`unsynced-${meeting.uid}`} className='rounded-[1.75rem] border border-slate-200 bg-white p-5'>
                <p className='text-base font-semibold'>{meeting.topic ?? '未命名會議'}</p>
                <p className='mt-1 text-sm text-slate-600'>開始時間：{meeting.start_time ? formatDateTime(meeting.start_time) : '未提供'}</p>
                <p className='mt-1 text-xs text-slate-500'>Meeting ID：{meeting.meetingId}</p>
                <p className='mt-1 text-xs text-slate-500'>課程名稱：{meeting.courseTitles.length > 0 ? meeting.courseTitles.join(' / ') : meeting.topic ?? '查無資料'}</p>
                <p className='mt-1 text-xs text-slate-500'>學生：{meeting.guestLabels.length > 0 ? meeting.guestLabels.join(' / ') : '查無資料'}</p>
                <p className='mt-1 text-xs text-slate-500'>對方信箱：{meeting.guestEmails.length > 0 ? meeting.guestEmails.join(' / ') : '查無資料'}</p>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {meeting.join_url ? (
                    <a className='inline-block rounded-full bg-slate-950 px-3 py-2 text-sm font-semibold text-white' href={meeting.join_url} target='_blank' rel='noreferrer'>
                      打開 Zoom 會議
                    </a>
                  ) : null}
                  <form action={deleteZoomMeetingAction}>
                    <input name='meetingId' type='hidden' value={meeting.meetingId} />
                    <ConfirmSubmitButton
                      className='rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600'
                      label='刪除會議'
                      message='這會刪除 Zoom 官方會議、相關場次與受邀者資料。若是定期會議，全部 occurrence 都會一起刪除。確定要繼續嗎？'
                    />
                  </form>
                </div>
                <form action={syncZoomMeetingAction} className='mt-4 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
                  <input name='meetingId' type='hidden' value={meeting.meetingId} />
                  <input name='joinUrl' type='hidden' value={meeting.join_url ?? ''} />
                  <input name='startTime' type='hidden' value={meeting.start_time ?? ''} />
                  <label className='text-sm font-semibold text-slate-700'>
                    綁定課程名稱
                    <input
                      className='mt-1 block w-full rounded border px-3 py-2 font-normal'
                      defaultValue={meeting.courseTitles[0] ?? meeting.topic ?? ''}
                      name='courseName'
                      required
                    />
                  </label>
                  <label className='text-sm font-semibold text-slate-700'>
                    受邀者 Email
                    <textarea
                      className='mt-1 block w-full rounded border px-3 py-2 font-normal'
                      defaultValue={meeting.guestEmails.join('\n')}
                      name='inviteeEmails'
                      rows={3}
                    />
                  </label>
                  <div className='flex flex-col justify-end gap-2'>
                    <button className='rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' type='submit'>
                      同步到課程日曆
                    </button>
                    <div className='text-xs text-slate-500'>會以 Meeting ID 為主，把這場 Zoom 會議的所有 occurrence 一起補綁。</div>
                  </div>
                </form>
              </article>
            ))}
            {unsyncedZoomMeetings.length > unsyncedPreview.length ? (
              <p className='text-xs text-slate-500'>僅顯示前 {unsyncedPreview.length} 筆，剩餘 {unsyncedZoomMeetings.length - unsyncedPreview.length} 筆未展開。</p>
            ) : null}
          </div>
        )}
      </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-5'>
      <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{label}</p>
      <p className='mt-3 text-xl font-black tracking-tight text-slate-950'>{value}</p>
    </article>
  );
}


