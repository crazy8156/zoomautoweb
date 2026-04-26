import Link from 'next/link';
import { requireAdminSession } from '../../lib/admin';
import { supabase } from '../../lib/supabase';
import { listZoomMeetings } from '../../lib/zoom';

export default async function AdminCourseCenterPage() {
  await requireAdminSession();

  const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
  const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });

  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const todayYear = todayParts.find((part) => part.type === 'year')?.value ?? '1970';
  const todayMonth = todayParts.find((part) => part.type === 'month')?.value ?? '01';
  const todayDay = todayParts.find((part) => part.type === 'day')?.value ?? '01';
  const todayKey = `${todayYear}-${todayMonth}-${todayDay}`;

  const { data: todaySessionRows } = await supabase
    .from('course_sessions')
    .select('id,zoom_meeting_id')
    .gte('start_time', `${todayKey}T00:00:00+08:00`)
    .lte('start_time', `${todayKey}T23:59:59+08:00`);

  const sessionMeetingIds = new Set((todaySessionRows ?? []).map((row) => String(row.zoom_meeting_id ?? '')).filter(Boolean));
  let zoomTodayCount = 0;

  try {
    const zoomMeetings = await listZoomMeetings();
    zoomTodayCount = zoomMeetings.filter((meeting) => {
      if (!meeting.start_time) return false;
      const dateKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(new Date(meeting.start_time))
        .reduce((acc, part) => {
          if (part.type === 'year') acc.y = part.value;
          if (part.type === 'month') acc.m = part.value;
          if (part.type === 'day') acc.d = part.value;
          return acc;
        }, { y: '', m: '', d: '' } as { y: string; m: string; d: string });

      const normalizedDateKey = `${dateKey.y}-${dateKey.m}-${dateKey.d}`;
      if (normalizedDateKey !== todayKey) return false;

      const meetingId = String(meeting.id ?? '');
      return !meetingId || !sessionMeetingIds.has(meetingId);
    }).length;
  } catch {
    zoomTodayCount = 0;
  }

  const todaySessionCount = (todaySessionRows?.length ?? 0) + zoomTodayCount;

  return (
    <main className='admin-shell'>
      <section className='admin-hero'>
        <header className='admin-topbar'>
          <div>
            <p className='admin-kicker'>Zoom 課程中心</p>
            <h1 className='admin-title'>課程中心</h1>
            <p className='admin-subtitle'>這裡集中處理 Zoom 課程、日曆、學生名單與預約資料，是老師每天排課和檢查進度的主要工作區。</p>
          </div>
          <div className='admin-actions'>
            <Link href='/admin' className='admin-link-pill'>
              回老師後台管理
            </Link>
            <Link href='/' className='admin-link-pill primary'>
              首頁
            </Link>
          </div>
        </header>

        <div className='admin-metric-grid'>
          <MetricCard label='今日課程' value={`${todaySessionCount}`} />
          <MetricCard label='課程總數' value={`${courseCount ?? 0}`} />
          <MetricCard label='預約總數' value={`${bookingCount ?? 0}`} />
          <MetricCard label='學生總數' value={`${studentCount ?? 0}`} />
        </div>
      </section>

      <section className='admin-main-grid sidebar'>
        <article className='admin-panel'>
          <p className='admin-kicker'>主要操作</p>
          <h2 className='mt-3 text-3xl font-black tracking-tight'>常用管理功能</h2>
          <p className='admin-subtitle'>建立課程、查看 Zoom 日曆、管理學生與處理預約，都可以從這裡直接進入。</p>

          <div className='admin-grid-buttons two'>
            <Link className='admin-primary-button' href='/admin/courses'>
              Zoom 課程管理
            </Link>
            <Link className='admin-primary-button' href='/admin/sessions'>
              Zoom 日曆
            </Link>
            <Link className='admin-secondary-button' href='/admin/students'>
              學生主名單
            </Link>
            <Link className='admin-secondary-button' href='/admin/bookings'>
              預約管理
            </Link>
          </div>
        </article>

        <aside className='admin-panel'>
          <p className='admin-kicker'>使用提醒</p>
          <h2 className='mt-3 text-2xl font-black tracking-tight'>目前工作方式</h2>
          <div className='admin-note-list'>
            <div className='admin-note-pill'>建議從平台後台建立 Zoom 會議，學生、課程、受邀者資料才能一起同步保存。</div>
            <div className='admin-note-pill'>學生主名單現在已整合課程學員與自學會員，不需要分兩邊維護。</div>
            <Link href='/admin/jaeasy' className='admin-link-pill'>
              前往自學中心後台
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='admin-metric-card'>
      <p className='admin-metric-label'>{label}</p>
      <p className='admin-metric-value'>{value}</p>
    </article>
  );
}
