import Link from 'next/link';
import { Course, formatCurrency } from './lib/domain';
import { supabase } from './lib/supabase';

export default async function HomePage() {
  const { data: courses } = await supabase
    .from('courses')
    .select('id,title,description,price,max_students,duration_minutes,is_active,created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30);

  const rows = (courses ?? []) as Course[];

  return (
    <main>
      <section className='border-b bg-slate-950 text-white'>
        <div className='mx-auto flex min-h-[46vh] max-w-6xl flex-col justify-center px-6 py-16'>
          <p className='text-sm font-semibold text-emerald-300'>Zoom live learning</p>
          <h1 className='mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl'>
            線上課程、即時場次、Zoom 上課連結一次管理。
          </h1>
          <p className='mt-5 max-w-2xl text-base leading-7 text-slate-200'>
            學生可以瀏覽課程與預約場次，老師可以在後台建立課程、開 Zoom 場次並查看預約名單。
          </p>
          <div className='mt-8 flex flex-wrap gap-3'>
            <a className='rounded bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950' href='#courses'>
              查看課程
            </a>
            <Link className='rounded border border-white/40 px-4 py-2 text-sm font-semibold text-white' href='/admin'>
              老師後台
            </Link>
          </div>
        </div>
      </section>

      <section id='courses' className='mx-auto max-w-6xl px-6 py-12'>
        <div className='mb-6 flex flex-wrap items-end justify-between gap-3'>
          <div>
            <p className='text-sm font-semibold text-emerald-700'>Courses</p>
            <h2 className='text-3xl font-bold'>開放預約課程</h2>
          </div>
          <Link className='text-sm font-semibold underline' href='/my-bookings'>
            查詢我的預約
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className='rounded border border-dashed p-8 text-sm text-slate-600'>
            目前尚未開放課程。請先到老師後台新增課程與場次。
          </div>
        ) : (
          <div className='grid gap-4 md:grid-cols-2'>
            {rows.map((course) => (
              <article key={course.id} className='rounded border bg-white p-5 shadow-sm'>
                <div className='flex items-start justify-between gap-4'>
                  <h3 className='text-xl font-semibold'>{course.title}</h3>
                  <p className='shrink-0 rounded bg-slate-100 px-2 py-1 text-sm font-semibold'>
                    {formatCurrency(course.price)}
                  </p>
                </div>
                <p className='mt-3 min-h-12 text-sm leading-6 text-slate-600'>
                  {course.description ?? '老師尚未填寫課程介紹。'}
                </p>
                <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
                  <div>
                    <dt className='text-slate-500'>課程時長</dt>
                    <dd className='font-semibold'>{course.duration_minutes ?? 60} 分鐘</dd>
                  </div>
                  <div>
                    <dt className='text-slate-500'>名額上限</dt>
                    <dd className='font-semibold'>{course.max_students} 人</dd>
                  </div>
                </dl>
                <Link
                  href={`/course/${course.id}`}
                  className='mt-5 inline-flex rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white'
                >
                  查看場次
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
