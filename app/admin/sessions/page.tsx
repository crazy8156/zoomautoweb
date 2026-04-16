import Link from 'next/link';
import { CourseSession, firstItem, formatDateTime } from '../../lib/domain';
import { supabase } from '../../lib/supabase';
import { getZoomMeetingById, listZoomMeetings } from '../../lib/zoom';

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
};

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

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
  const sessions = yearSessions.filter((session) => {
    return toTaipeiDateKey(session.start_time) === selectedDate;
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

  const expandedZoomMeetings: ZoomCalendarItem[] = [];
  for (const meeting of zoomMeetings) {
    const detail = await getZoomMeetingById(meeting.id);
    const occurrences = detail?.occurrences?.filter((item) => (item.status ?? 'available') !== 'deleted') ?? [];

    if (occurrences.length === 0) {
      expandedZoomMeetings.push({
        uid: `${meeting.id}`,
        meetingId: meeting.id,
        topic: meeting.topic,
        start_time: meeting.start_time,
        join_url: meeting.join_url,
      });
      continue;
    }

    occurrences.forEach((occurrence) => {
      expandedZoomMeetings.push({
        uid: `${meeting.id}-${occurrence.occurrence_id ?? occurrence.start_time ?? 'occurrence'}`,
        meetingId: meeting.id,
        topic: meeting.topic,
        start_time: occurrence.start_time ?? meeting.start_time,
        join_url: meeting.join_url,
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

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>課程管理</h1>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin/courses'>新增課程</Link>
          <Link href='/admin'>回儀表板</Link>
        </div>
      </header>

      <section className='rounded border bg-white p-6 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2 className='text-xl font-semibold'>課程日曆</h2>
          <div className='flex items-center gap-2 text-sm'>
            <Link
              className='rounded border px-3 py-1.5 font-semibold'
              href={`/admin/sessions?month=${toMonthKey(new Date(year, monthIndex - 1, 1))}&date=${selectedDate}`}
            >
              上個月
            </Link>
            <span className='font-semibold'>{year}/{pad2(monthIndex + 1)}</span>
            <Link
              className='rounded border px-3 py-1.5 font-semibold'
              href={`/admin/sessions?month=${toMonthKey(new Date(year, monthIndex + 1, 1))}&date=${selectedDate}`}
            >
              下個月
            </Link>
          </div>
        </div>

        <div className='mt-4 grid grid-cols-7 gap-2 text-xs font-semibold text-slate-500'>
          {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
            <div key={label} className='text-center'>
              {label}
            </div>
          ))}
        </div>

        <div className='mt-2 grid grid-cols-7 gap-2'>
          {Array.from({ length: new Date(year, monthIndex, 1).getDay() }).map((_, idx) => (
            <div key={`empty-${idx}`} className='h-12 rounded border border-transparent' />
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
                className={`flex h-12 items-center justify-center rounded border text-sm font-semibold ${
                  isSelected ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
                }`}
              >
                <span>{day}</span>
                {hasSession ? <span className='ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500' /> : null}
              </Link>
            );
          })}
        </div>
      </section>

      <div className='mt-6 grid gap-3'>
        <h2 className='text-lg font-semibold'>當天課程清單（{selectedDate}）</h2>
        {sessions.length === 0 && zoomMeetingsForSelectedDate.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>當天沒有課程。請點日曆其他日期或先建立場次。</div>
        ) : (
          <>
            {sessions.map((session) => {
              const course = firstItem(session.courses);
              return (
                <article key={session.id} className='rounded border bg-white p-5 shadow-sm'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <h2 className='text-lg font-semibold'>{course?.title ?? '未設定課程'}</h2>
                      <p className='mt-1 text-sm text-slate-600'>{formatDateTime(session.start_time)}</p>
                      <p className='mt-1 text-xs text-slate-500'>Meeting ID：{session.zoom_meeting_id ?? '未記錄'}</p>
                    </div>
                    {session.zoom_join_url ? <a className='rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white' href={session.zoom_join_url} target='_blank' rel='noreferrer'>打開 Zoom</a> : <span className='rounded bg-slate-100 px-3 py-2 text-sm text-slate-600'>尚未建立 Zoom</span>}
                  </div>
                </article>
              );
            })}
            {sessions.length === 0
              ? zoomMeetingsForSelectedDate.map((meeting) => (
                  <article key={`zoom-${meeting.uid}`} className='rounded border bg-white p-5 shadow-sm'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <h2 className='text-lg font-semibold'>{meeting.topic ?? '未命名會議'}</h2>
                        <p className='mt-1 text-sm text-slate-600'>開始時間：{meeting.start_time ? formatDateTime(meeting.start_time) : '未提供'}</p>
                        <p className='mt-1 text-xs text-slate-500'>Meeting ID：{meeting.meetingId}</p>
                      </div>
                      {meeting.join_url ? (
                        <a className='rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white' href={meeting.join_url} target='_blank' rel='noreferrer'>
                          打開 Zoom
                        </a>
                      ) : (
                        <span className='rounded bg-slate-100 px-3 py-2 text-sm text-slate-600'>無連結</span>
                      )}
                    </div>
                  </article>
                ))
              : null}
          </>
        )}
      </div>

      <section className='mt-8 rounded border bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold'>Zoom 近期會議（即時抓取）</h2>
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
              <article key={meeting.uid} className='rounded border p-4'>
                <p className='text-base font-semibold'>{meeting.topic ?? '未命名會議'}</p>
                <p className='mt-1 text-sm text-slate-600'>開始時間：{meeting.start_time ? formatDateTime(meeting.start_time) : '未提供'}</p>
                <p className='mt-1 text-xs text-slate-500'>Meeting ID：{meeting.meetingId}</p>
                {meeting.join_url ? (
                  <a className='mt-2 inline-block rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white' href={meeting.join_url} target='_blank' rel='noreferrer'>
                    打開 Zoom 會議
                  </a>
                ) : null}
              </article>
            ))}
            <div className='mt-4 flex items-center justify-between text-sm'>
              <p className='text-slate-600'>
                第 {safeZoomPage} / {zoomTotalPages} 頁（共 {expandedZoomMeetings.length} 筆）
              </p>
              <div className='flex gap-2'>
                {safeZoomPage > 1 ? (
                  <Link
                    className='rounded border px-3 py-1.5 font-semibold'
                    href={`/admin/sessions?month=${monthKey}&date=${selectedDate}&zoomPage=${safeZoomPage - 1}`}
                  >
                    上一頁
                  </Link>
                ) : (
                  <span className='rounded border px-3 py-1.5 text-slate-400'>上一頁</span>
                )}
                {safeZoomPage < zoomTotalPages ? (
                  <Link
                    className='rounded border px-3 py-1.5 font-semibold'
                    href={`/admin/sessions?month=${monthKey}&date=${selectedDate}&zoomPage=${safeZoomPage + 1}`}
                  >
                    下一頁
                  </Link>
                ) : (
                  <span className='rounded border px-3 py-1.5 text-slate-400'>下一頁</span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className='mt-8 rounded border bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold'>官方列表逐筆比對</h2>
        <p className='mt-2 text-xs text-slate-500'>下方是 Zoom 官方清單存在，但目前還沒同步到日曆資料表的會議。</p>
        <p className='mt-3 text-sm text-slate-700'>未同步數量：{unsyncedZoomMeetings.length}</p>
        {unsyncedPreview.length === 0 ? (
          <p className='mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>目前沒有未同步會議。</p>
        ) : (
          <div className='mt-4 space-y-3'>
            {unsyncedPreview.map((meeting) => (
              <article key={`unsynced-${meeting.uid}`} className='rounded border p-4'>
                <p className='text-base font-semibold'>{meeting.topic ?? '未命名會議'}</p>
                <p className='mt-1 text-sm text-slate-600'>開始時間：{meeting.start_time ? formatDateTime(meeting.start_time) : '未提供'}</p>
                <p className='mt-1 text-xs text-slate-500'>Meeting ID：{meeting.meetingId}</p>
                {meeting.join_url ? (
                  <a className='mt-2 inline-block rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white' href={meeting.join_url} target='_blank' rel='noreferrer'>
                    打開 Zoom 會議
                  </a>
                ) : null}
              </article>
            ))}
            {unsyncedZoomMeetings.length > unsyncedPreview.length ? (
              <p className='text-xs text-slate-500'>僅顯示前 {unsyncedPreview.length} 筆，剩餘 {unsyncedZoomMeetings.length - unsyncedPreview.length} 筆未展開。</p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}


