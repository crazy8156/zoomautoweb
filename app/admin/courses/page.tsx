import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { CourseScheduleTimingSection } from '../../components/course-schedule-timing-section';
import { requireAdminSession } from '../../lib/admin';
import { findOrCreateCourseByTitle } from '../../lib/course-admin';
import { parseInviteeEmails } from '../../lib/email';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { addZoomMeetingRegistrant, createZoomMeeting, getZoomMeetingById } from '../../lib/zoom';

type RecurringScheduleGroup = {
  label: string;
  weeklyDays: string[];
  startClock: string;
  durationMinutes: number;
  endTimes: number;
};

type StudentOption = {
  id: string;
  name: string | null;
  email: string;
  source: string | null;
};

type InviteeProfile = {
  email: string;
  studentId: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
};

function parsePositiveNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseWeeklyDays(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((item) => String(item))
    .filter((value) => /^[1-7]$/.test(value));
}

function toZoomWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFirstOccurrenceDate(startDate: string, weeklyDays: string[]) {
  const anchor = new Date(`${startDate}T12:00:00+08:00`);

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(anchor);
    candidate.setUTCDate(anchor.getUTCDate() + offset);
    if (weeklyDays.includes(String(toZoomWeekday(candidate)))) {
      return toDateKey(candidate);
    }
  }

  return startDate;
}

function buildRegistrantNameParts(fullName: string, email: string) {
  const normalizedFullName = fullName.trim();
  if (!normalizedFullName) {
    return {
      firstName: email.split('@')[0] || 'Student',
      lastName: '',
    };
  }

  const parts = normalizedFullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function insertCourseSessionsForMeeting({
  courseId,
  startTime,
  meetingId,
  joinUrl,
}: {
  courseId: string;
  startTime: string;
  meetingId: number;
  joinUrl: string;
}) {
  const detail = await getZoomMeetingById(meetingId);
  const occurrences = detail?.occurrences?.filter((item) => (item.status ?? 'available') !== 'deleted') ?? [];

  const rows =
    occurrences.length > 0
      ? occurrences.map((occurrence) => ({
          course_id: courseId,
          start_time: occurrence.start_time ?? startTime,
          zoom_join_url: joinUrl,
          zoom_meeting_id: meetingId,
        }))
      : [
          {
            course_id: courseId,
            start_time: detail?.start_time ?? startTime,
            zoom_join_url: joinUrl,
            zoom_meeting_id: meetingId,
          },
        ];

  const { error } = await supabaseAdmin.from('course_sessions').insert(rows);
  if (error) throw new Error(`Zoom 會議已建立，但寫入 Supabase 場次失敗：${error.message}`);
}

async function saveMeetingInvitees(meetingId: number, inviteeEmails: string[]) {
  if (inviteeEmails.length === 0) return;

  const normalizedMeetingId = String(meetingId);
  const { error } = await supabaseAdmin
    .from('zoom_meeting_invitees')
    .upsert(
      inviteeEmails.map((email) => ({
        zoom_meeting_id: normalizedMeetingId,
        email,
      })),
      { onConflict: 'zoom_meeting_id,email' },
    );

  if (error) {
    throw new Error(`會議已建立，但儲存受邀者 Email 失敗：${error.message}`);
  }
}

async function resolveInviteeProfiles(inviteeEmails: string[]) {
  if (inviteeEmails.length === 0) return [] as InviteeProfile[];

  const { data: studentRows, error } = await supabaseAdmin
    .from('students')
    .select('id,name,email')
    .in('email', inviteeEmails);

  if (error) {
    throw new Error(`查詢受邀學生資料失敗：${error.message}`);
  }

  const studentByEmail = new Map(
    (studentRows ?? [])
      .filter((row) => row.email)
      .map((row) => [String(row.email).trim().toLowerCase(), row]),
  );

  return inviteeEmails.map((email) => {
    const student = studentByEmail.get(email);
    const fullName = String(student?.name ?? '').trim();
    const { firstName, lastName } = buildRegistrantNameParts(fullName, email);

    return {
      email,
      studentId: student?.id ?? null,
      fullName,
      firstName,
      lastName,
    } satisfies InviteeProfile;
  });
}

async function saveMeetingRegistrants(meetingId: number, invitees: InviteeProfile[]) {
  if (invitees.length === 0) return;

  const rows: Array<{
    zoom_meeting_id: string;
    email: string;
    student_id: string | null;
    first_name: string;
    last_name: string | null;
    zoom_registrant_id: string | null;
    join_url: string | null;
    status: string;
    updated_at: string;
  }> = [];
  for (const invitee of invitees) {
    const registrant = await addZoomMeetingRegistrant({
      meetingId,
      email: invitee.email,
      firstName: invitee.firstName,
      lastName: invitee.lastName || undefined,
    });

    rows.push({
      zoom_meeting_id: String(meetingId),
      email: invitee.email,
      student_id: invitee.studentId,
      first_name: invitee.firstName,
      last_name: invitee.lastName || null,
      zoom_registrant_id: registrant.registrant_id ?? registrant.id ?? null,
      join_url: registrant.join_url ?? null,
      status: registrant.status ?? 'approved',
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await supabaseAdmin.from('zoom_meeting_registrants').upsert(rows, {
    onConflict: 'zoom_meeting_id,email',
  });

  if (error) {
    throw new Error(`會議已建立，但儲存 Zoom 註冊資料失敗：${error.message}`);
  }
}

async function createZoomSession(formData: FormData) {
  'use server';

  await requireAdminSession();

  const courseName = String(formData.get('courseName') ?? '').trim();
  const topicInput = String(formData.get('topic') ?? '').trim();
  const agenda = String(formData.get('agenda') ?? '').trim();
  const manualInviteeEmails = parseInviteeEmails(String(formData.get('inviteeEmails') ?? ''));
  const selectedInviteeEmails = parseInviteeEmails(formData.getAll('inviteeStudentEmails').join('\n'));
  const inviteeEmails = Array.from(new Set([...manualInviteeEmails, ...selectedInviteeEmails]));
  const inviteeProfiles = await resolveInviteeProfiles(inviteeEmails);
  const meetingDate = String(formData.get('meetingDate') ?? '');
  const startClock = String(formData.get('startClock') ?? '');
  const durationMinutes = parsePositiveNumber(formData.get('durationMinutes'), 60);
  const timezone = String(formData.get('timezone') ?? 'Asia/Taipei');
  const password = String(formData.get('password') ?? '').trim();
  const usePmi = formData.get('meetingIdType') === 'pmi';
  const waitingRoom = formData.get('waitingRoom') === 'on';
  const requireRegistration = formData.get('requireRegistration') === 'on';
  const joinBeforeHost = formData.get('joinBeforeHost') === 'on';
  const muteUponEntry = formData.get('muteUponEntry') === 'on';
  const autoRecordingRaw = String(formData.get('autoRecording') ?? 'none');
  const autoRecording = autoRecordingRaw === 'local' || autoRecordingRaw === 'cloud' ? autoRecordingRaw : 'none';
  const audioRaw = String(formData.get('audio') ?? 'voip');
  const audio = audioRaw === 'telephony' || audioRaw === 'both' ? audioRaw : 'voip';
  const hostVideo = String(formData.get('hostVideo') ?? 'off') === 'on';
  const participantVideo = String(formData.get('participantVideo') ?? 'off') === 'on';
  const isRecurring = formData.get('isRecurring') === 'on';
  const repeatInterval = parsePositiveNumber(formData.get('repeatInterval'), 1);
  const { id: courseId, title: normalizedCourseName } = await findOrCreateCourseByTitle(courseName);
  const topic = topicInput || normalizedCourseName;

  if (!meetingDate || !startClock) throw new Error('請填寫日期與開始時間。');
  if (!topic) throw new Error('請填寫課程主題。');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('請填寫正確的持續時間。');
  const startTime = `${meetingDate}T${startClock}`;

  if (!isRecurring) {
    const meeting = await createZoomMeeting({
      topic,
      startTime,
      durationMinutes,
      agenda: agenda || undefined,
      timezone,
      password: password || undefined,
      usePmi,
      requireRegistration,
      waitingRoom,
      joinBeforeHost,
      muteUponEntry,
      autoRecording,
      audio,
      hostVideo,
      participantVideo,
      isRecurring: false,
    });

    await insertCourseSessionsForMeeting({
      courseId,
      startTime,
      meetingId: meeting.id,
      joinUrl: meeting.join_url,
    });
    await saveMeetingInvitees(meeting.id, inviteeEmails);
    if (requireRegistration) {
      await saveMeetingRegistrants(meeting.id, inviteeProfiles);
    }
  } else {
    const recurringGroups: RecurringScheduleGroup[] = [1, 2, 3]
      .map((index) => {
        const enabled = formData.get(`recurringGroup${index}Enabled`) === 'on';
        if (!enabled) return null;

        const weeklyDays = parseWeeklyDays(formData, `recurringGroup${index}WeeklyDays`);
        const recurringStartClock = String(formData.get(`recurringGroup${index}StartClock`) ?? '').trim();
        const recurringDuration = parsePositiveNumber(formData.get(`recurringGroup${index}DurationMinutes`), durationMinutes);
        const endTimes = parsePositiveNumber(formData.get(`recurringGroup${index}EndTimes`), 12);

        if (weeklyDays.length === 0 || !recurringStartClock) {
          return null;
        }

        return {
          label: String(formData.get(`recurringGroup${index}Label`) ?? `定期時段 ${index}`).trim() || `定期時段 ${index}`,
          weeklyDays,
          startClock: recurringStartClock,
          durationMinutes: recurringDuration,
          endTimes,
        };
      })
      .filter((item): item is RecurringScheduleGroup => Boolean(item));

    if (recurringGroups.length === 0) {
      throw new Error('請至少啟用一組定期時段，並設定星期與開始時間。');
    }

    for (const group of recurringGroups) {
      const firstDate = getFirstOccurrenceDate(meetingDate, group.weeklyDays);
      const recurringStartTime = `${firstDate}T${group.startClock}`;
      const meeting = await createZoomMeeting({
        topic: `${topic}｜${group.label}`,
        startTime: recurringStartTime,
        durationMinutes: group.durationMinutes,
        agenda: agenda || undefined,
        timezone,
        password: password || undefined,
        usePmi,
        requireRegistration,
        waitingRoom,
        joinBeforeHost,
        muteUponEntry,
        autoRecording,
        audio,
        hostVideo,
        participantVideo,
        isRecurring: true,
        recurrence: {
          type: 2,
          repeatInterval,
          weeklyDays: group.weeklyDays.join(','),
          endTimes: group.endTimes,
        },
      });

      await insertCourseSessionsForMeeting({
        courseId,
        startTime: recurringStartTime,
        meetingId: meeting.id,
        joinUrl: meeting.join_url,
      });
      await saveMeetingInvitees(meeting.id, inviteeEmails);
      if (requireRegistration) {
        await saveMeetingRegistrants(meeting.id, inviteeProfiles);
      }
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/course-center');
  revalidatePath('/admin/courses');
  revalidatePath('/admin/sessions');
  revalidatePath('/');
  revalidatePath('/student');
  revalidatePath('/student/course-center');
}

export default async function AdminCoursesPage() {
  await requireAdminSession();

  const defaultPasscode = '123456';
  const today = new Date();
  const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data: studentRows, error: studentsError } = await supabaseAdmin
    .from('students')
    .select('id,name,email,source')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (studentsError) {
    throw new Error(`讀取學生名單失敗：${studentsError.message}`);
  }

  const students = ((studentRows ?? []) as StudentOption[])
    .filter((student) => Boolean(student.email))
    .map((student) => ({
      ...student,
      email: student.email.trim().toLowerCase(),
      name: student.name?.trim() || '未命名學生',
      source: student.source?.trim() || 'manual',
    }));

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef5ff_42%,#e7eefb_100%)] px-6 py-8 text-slate-950 md:px-8 md:py-10'>
      <div className='mx-auto max-w-7xl'>
        <section className='rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>Zoom 課程建立</p>
              <h1 className='mt-3 font-["Plus_Jakarta_Sans"] text-4xl font-extrabold tracking-tight md:text-6xl'>
                Zoom 課程管理
              </h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡會同時建立 Zoom 會議、課程場次、學生受邀名單與註冊控管。之後學生中心、Zoom 日曆和課程名單都會共用這份資料。
              </p>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                className='rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
                href='/admin/course-center'
              >
                回老師後台管理
              </Link>
              <button
                className='rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'
                form='schedule-form'
                type='submit'
              >
                儲存並發布
              </button>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <MetricCard label='可選學生' value={`${students.length}`} />
            <MetricCard label='定期時段' value='最多 3 組' />
            <MetricCard label='同步內容' value='Zoom + 課程日曆' />
          </div>
        </section>

        <form action={createZoomSession} className='mt-8 grid grid-cols-12 gap-6' id='schedule-form'>
          <div className='col-span-12 space-y-6 xl:col-span-8'>
            <section className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8'>
              <div className='mb-6'>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>基本設定</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight'>課程與受邀資料</h2>
              </div>

              <div className='grid gap-5'>
                <label className='block'>
                  <span className='mb-2 block text-sm font-bold text-slate-700'>課程名稱</span>
                  <input
                    className='w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4'
                    name='courseName'
                    placeholder='例如：N5 日文入門班 / 國中數學衝刺班'
                    required
                  />
                </label>

                <label className='block'>
                  <span className='mb-2 block text-sm font-bold text-slate-700'>會議主題</span>
                  <input
                    className='w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4'
                    name='topic'
                    placeholder='不填時會自動沿用課程名稱'
                  />
                </label>

                <label className='block'>
                  <span className='mb-2 block text-sm font-bold text-slate-700'>課程說明</span>
                  <textarea
                    className='w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4'
                    name='agenda'
                    placeholder='請輸入課程大綱、上課說明或學生提醒事項'
                    rows={4}
                  />
                </label>

                <label className='block'>
                  <span className='mb-2 block text-sm font-bold text-slate-700'>受邀者 Email</span>
                  <textarea
                    className='w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4'
                    name='inviteeEmails'
                    placeholder={'每行一個 Email，或用逗號分隔。\n例如：\nstudent1@gmail.com\nstudent2@gmail.com'}
                    rows={4}
                  />
                  <p className='mt-2 text-xs leading-6 text-slate-500'>這份名單會保存到平台，之後可以對應學生註冊、Zoom 日曆與課程名單。</p>
                </label>

                <div>
                  <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
                    <div>
                      <p className='text-sm font-bold text-slate-700'>直接選學生</p>
                      <p className='text-xs leading-6 text-slate-500'>勾選後會自動把學生 Email 帶進這場會議，不用再手打一次。</p>
                    </div>
                    <span className='rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700'>學生主名單同步</span>
                  </div>
                  {students.length > 0 ? (
                    <div className='grid max-h-80 gap-3 overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2'>
                      {students.map((student) => (
                        <label key={student.id} className='flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3'>
                          <input className='mt-1' name='inviteeStudentEmails' type='checkbox' value={student.email} />
                          <div>
                            <p className='text-sm font-bold text-slate-900'>{student.name}</p>
                            <p className='mt-1 text-xs text-slate-500'>{student.email}</p>
                            <p className='mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400'>{student.source}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className='rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600'>
                      目前還沒有學生資料，請先讓學生註冊，或先到學生主名單建立學生。
                    </div>
                  )}
                </div>
              </div>
            </section>

            <CourseScheduleTimingSection defaultMeetingDate={dateValue} />

            <section className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8'>
              <div className='mb-6'>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>安全設定</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight'>會議設定與安全性</h2>
              </div>

              <div className='grid gap-6 md:grid-cols-2'>
                <div>
                  <p className='mb-3 text-sm font-bold text-slate-700'>會議 ID</p>
                  <div className='grid gap-3'>
                    <label className='flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700'>
                      <input defaultChecked name='meetingIdType' type='radio' value='auto' />
                      自動產生會議 ID
                    </label>
                    <label className='flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700'>
                      <input name='meetingIdType' type='radio' value='pmi' />
                      使用個人會議 ID
                    </label>
                  </div>
                </div>

                <label className='block'>
                  <span className='mb-2 block text-sm font-bold text-slate-700'>存取密碼</span>
                  <input className='w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4' defaultValue={defaultPasscode} name='password' />
                </label>
              </div>

              <div className='mt-6 grid gap-4'>
                <label className='flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4'>
                  <div>
                    <p className='text-sm font-bold text-slate-800'>啟用等候室</p>
                    <p className='mt-1 text-xs text-slate-500'>學生會先進入等候室，再由老師放行。</p>
                  </div>
                  <input defaultChecked name='waitingRoom' type='checkbox' />
                </label>
                <label className='flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4'>
                  <div>
                    <p className='text-sm font-bold text-slate-800'>學員註冊控管（Zoom Registration）</p>
                    <p className='mt-1 text-xs text-slate-500'>開啟後會替學生建立 Zoom registrant，學生中心會優先顯示專屬 join link。</p>
                  </div>
                  <input name='requireRegistration' type='checkbox' />
                </label>
              </div>
            </section>
          </div>

          <div className='col-span-12 space-y-6 xl:col-span-4'>
            <section className='rounded-[2rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-7 text-white shadow-[0_28px_70px_rgba(11,92,255,0.24)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>智慧功能</p>
              <h2 className='mt-2 text-2xl font-black tracking-tight'>智慧延伸功能</h2>
              <div className='mt-6 space-y-5'>
                <label className='flex items-start gap-3'>
                  <input defaultChecked type='checkbox' />
                  <div>
                    <p className='text-sm font-bold'>自動會議摘要</p>
                    <p className='mt-1 text-xs leading-6 text-sky-50/80'>會議結束後整理重點與待辦事項，適合後續追蹤。</p>
                  </div>
                </label>
                <label className='flex items-start gap-3'>
                  <input defaultChecked type='checkbox' />
                  <div>
                    <p className='text-sm font-bold'>智慧 Q&amp;A 解析</p>
                    <p className='mt-1 text-xs leading-6 text-sky-50/80'>整理課堂提問脈絡，方便之後做學習摘要。</p>
                  </div>
                </label>
                <label className='flex items-start gap-3'>
                  <input type='checkbox' />
                  <div>
                    <p className='text-sm font-bold'>即時字幕與翻譯</p>
                    <p className='mt-1 text-xs leading-6 text-sky-50/80'>適合跨國學生或雙語課程情境。</p>
                  </div>
                </label>
              </div>
            </section>

            <section className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='mb-6'>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>音訊與視訊</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight'>視訊與音訊</h2>
              </div>

              <div className='space-y-5'>
                <FieldSelect label='主持人視訊' name='hostVideo' defaultValue='off' options={[['on', '開啟'], ['off', '關閉']]} />
                <FieldSelect label='參與者視訊' name='participantVideo' defaultValue='off' options={[['on', '開啟'], ['off', '關閉']]} />
                <FieldSelect
                  label='音訊來源'
                  name='audio'
                  defaultValue='voip'
                  options={[
                    ['voip', '電腦音訊'],
                    ['telephony', '電話音訊'],
                    ['both', '同時使用'],
                  ]}
                />

                <label className='flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
                  <span className='text-sm font-semibold text-slate-700'>允許主持人前加入</span>
                  <input name='joinBeforeHost' type='checkbox' />
                </label>
                <label className='flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3'>
                  <span className='text-sm font-semibold text-slate-700'>入會即靜音</span>
                  <input defaultChecked name='muteUponEntry' type='checkbox' />
                </label>

                <FieldSelect
                  label='自動錄影'
                  name='autoRecording'
                  defaultValue='none'
                  options={[
                    ['none', '不錄影'],
                    ['local', '本機錄影'],
                    ['cloud', '雲端錄影'],
                  ]}
                />
              </div>
            </section>

            <section className='rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-emerald-700'>快速提醒</p>
              <h3 className='mt-2 text-xl font-black tracking-tight text-slate-900'>建立後去哪裡看？</h3>
              <p className='mt-3 text-sm leading-7 text-slate-600'>
                這裡建立完成後，課程場次會同步進 Zoom 日曆，學生受邀資料也會一起保存在平台裡。
              </p>
              <Link className='mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white' href='/admin/sessions'>
                前往 Zoom 日曆
              </Link>
            </section>
          </div>
        </form>
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

function FieldSelect({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className='block'>
      <span className='mb-2 block text-sm font-bold text-slate-700'>{label}</span>
      <select className='w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3' defaultValue={defaultValue} name={name}>
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

