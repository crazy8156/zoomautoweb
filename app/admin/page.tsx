import Link from 'next/link';
import { requireAdminSession } from '../lib/admin';
import { getJaeasyAdminOverview } from '../lib/jaeasy-admin';
import { supabase } from '../lib/supabase';
import { listZoomMeetings } from '../lib/zoom';

export default async function AdminPage() {
  await requireAdminSession();

  const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
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

  const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
  const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
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
  const jaeasyOverview = await getJaeasyAdminOverview();

  return (
    <main className='admin-shell'>
      <section className='admin-hero'>
        <header className='admin-topbar'>
          <div>
            <p className='admin-kicker'>老師後台管理</p>
            <h1 className='admin-title'>老師後台管理</h1>
            <p className='admin-subtitle'>
              這裡是整個教學平台的管理入口，會把 Zoom 課程、自學中心、學生主名單與教務資料集中在同一個後台。
            </p>
          </div>
          <div className='admin-actions'>
            <Link href='/' className='admin-link-pill'>
              首頁
            </Link>
            <a href='/admin/logout' className='admin-link-pill primary'>
              登出
            </a>
          </div>
        </header>
      </section>

      <section className='admin-main-grid two'>
        <article className='admin-panel'>
          <div className='admin-topbar'>
            <div>
              <p className='admin-kicker'>Zoom 教學端</p>
              <h2 className='text-3xl font-black tracking-tight'>課程中心</h2>
              <p className='admin-subtitle'>管理 Zoom 課程、排程場次、學生課表與日曆同步。</p>
            </div>
            <Link href='/admin/course-center' className='admin-link-pill primary'>
              前往課程中心
            </Link>
          </div>

          <div className='admin-metric-grid'>
            <MetricCard label='今日課程' value={`${todaySessionCount ?? 0}`} />
            <MetricCard label='課程總數' value={`${courseCount ?? 0}`} />
            <MetricCard label='預約總數' value={`${bookingCount ?? 0}`} />
            <MetricCard label='學生人數' value={`${studentCount ?? 0}`} />
          </div>

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

        <article className='admin-panel'>
          <div className='admin-topbar'>
            <div>
              <p className='admin-kicker'>自學教學端</p>
              <h2 className='text-3xl font-black tracking-tight'>自學中心</h2>
              <p className='admin-subtitle'>管理自學會員、字庫題庫、測驗紀錄與學生自學數據。</p>
            </div>
            <Link href='/admin/jaeasy' className='admin-link-pill primary'>
              前往自學中心後台
            </Link>
          </div>

          <div className='admin-metric-grid'>
            <MetricCard label='自學會員' value={`${jaeasyOverview.registeredMemberCount ?? 0}`} />
            <MetricCard label='單字總數' value={`${jaeasyOverview.contentSummary.vocabularyCount}`} />
            <MetricCard label='題目總數' value={`${jaeasyOverview.contentSummary.manualQuestionCount}`} />
            <MetricCard label='作答次數' value={`${jaeasyOverview.contentSummary.totalAttemptCount}`} />
          </div>

          <div className='admin-grid-buttons two'>
            <Link className='admin-primary-button' href='/admin/students'>
              學生主名單
            </Link>
            <Link className='admin-primary-button' href='/admin/jaeasy/content'>
              字庫與題庫管理
            </Link>
            <Link className='admin-secondary-button' href='/admin/jaeasy'>
              自學中心總覽
            </Link>
            <Link className='admin-secondary-button' href='/jaeasy'>
              查看前台自學中心
            </Link>
          </div>
        </article>
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
