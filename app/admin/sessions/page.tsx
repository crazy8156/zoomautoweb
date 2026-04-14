import Link from 'next/link';
import { CourseSession, firstItem, formatDateTime } from '../../lib/domain';
import { supabase } from '../../lib/supabase';

export default async function AdminSessionsPage() {
  const { data } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,zoom_join_url,zoom_meeting_id,courses:course_id(title,duration_minutes,price)')
    .order('start_time', { ascending: false })
    .limit(100);

  const sessions = (data ?? []) as CourseSession[];

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>場次管理</h1>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin/courses'>建立場次</Link>
          <Link href='/admin'>回儀表板</Link>
        </div>
      </header>

      <div className='grid gap-3'>
        {sessions.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>目前還沒有場次。請先到課程管理建立 Zoom 場次。</div>
        ) : (
          sessions.map((session) => {
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
          })
        )}
      </div>
    </main>
  );
}
