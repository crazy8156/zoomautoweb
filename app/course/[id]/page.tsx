import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Course, CourseSession, formatCurrency, formatDateTime } from '../../lib/domain';
import { supabase } from '../../lib/supabase';

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: course } = await supabase
    .from('courses')
    .select('id,title,description,price,max_students,duration_minutes,is_active,created_at')
    .eq('id', id)
    .single();

  if (!course) return notFound();

  const { data: sessions } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,zoom_join_url,zoom_meeting_id')
    .eq('course_id', id)
    .order('start_time', { ascending: true })
    .limit(50);

  const row = course as Course;
  const sessionRows = (sessions ?? []) as CourseSession[];

  return (
    <main className='mx-auto max-w-5xl px-6 py-10'>
      <div className='mb-6 flex flex-wrap justify-between gap-3'>
        <Link href='/' className='text-sm font-semibold underline'>回課程列表</Link>
        <Link href='/my-bookings' className='text-sm font-semibold underline'>查詢我的預約</Link>
      </div>

      <section className='rounded border bg-white p-6 shadow-sm'>
        <p className='text-sm font-semibold text-emerald-700'>Course</p>
        <h1 className='mt-2 text-3xl font-bold'>{row.title}</h1>
        <p className='mt-4 max-w-3xl leading-7 text-slate-700'>{row.description ?? '老師尚未填寫課程介紹。'}</p>
        <dl className='mt-6 grid gap-4 text-sm md:grid-cols-3'>
          <div className='rounded bg-slate-50 p-4'>
            <dt className='text-slate-500'>價格</dt>
            <dd className='mt-1 text-lg font-semibold'>{formatCurrency(row.price)}</dd>
          </div>
          <div className='rounded bg-slate-50 p-4'>
            <dt className='text-slate-500'>課程時長</dt>
            <dd className='mt-1 text-lg font-semibold'>{row.duration_minutes ?? 60} 分鐘</dd>
          </div>
          <div className='rounded bg-slate-50 p-4'>
            <dt className='text-slate-500'>名額上限</dt>
            <dd className='mt-1 text-lg font-semibold'>{row.max_students} 人</dd>
          </div>
        </dl>
      </section>

      <section className='mt-8'>
        <h2 className='text-2xl font-bold'>可預約場次</h2>
        {sessionRows.length === 0 ? (
          <div className='mt-4 rounded border border-dashed p-6 text-sm text-slate-600'>
            目前還沒有開放場次。請稍後再回來查看。
          </div>
        ) : (
          <div className='mt-4 grid gap-3'>
            {sessionRows.map((session) => (
              <article key={session.id} className='flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4'>
                <div>
                  <p className='font-semibold'>{formatDateTime(session.start_time)}</p>
                  <p className='mt-1 text-sm text-slate-600'>預約成功後可在「我的預約」查看 Zoom 連結。</p>
                </div>
                <Link
                  href={`/course/${row.id}/book?sessionId=${session.id}`}
                  className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white'
                >
                  預約這堂課
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
