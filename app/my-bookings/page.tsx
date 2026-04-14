import Link from 'next/link';
import { Booking, CourseSession, firstItem, formatDateTime } from '../lib/domain';
import { supabase } from '../lib/supabase';

type BookingWithSession = Booking & {
  course_sessions: CourseSession | CourseSession[] | null;
};

export default async function MyBookingsPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const { studentId } = await searchParams;
  const trimmedStudentId = studentId?.trim();

  const { data } = trimmedStudentId
    ? await supabase
        .from('bookings')
        .select('id,status,booked_at,student_id,session_id,course_sessions:session_id(id,start_time,zoom_join_url,courses:course_id(title,duration_minutes,price))')
        .eq('student_id', trimmedStudentId)
        .order('booked_at', { ascending: false })
        .limit(50)
    : { data: [] };

  const bookings = (data ?? []) as unknown as BookingWithSession[];

  return (
    <main className='mx-auto max-w-5xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Student</p>
          <h1 className='text-3xl font-bold'>我的預約</h1>
        </div>
        <Link href='/' className='text-sm font-semibold underline'>回課程列表</Link>
      </header>

      <form className='rounded border bg-white p-5 shadow-sm'>
        <label className='block text-sm font-semibold'>
          學生 UUID
          <input
            className='mt-1 block w-full rounded border px-3 py-2 font-normal'
            defaultValue={trimmedStudentId}
            name='studentId'
            placeholder='預約成功後網址會帶入查詢用 UUID'
          />
        </label>
        <button className='mt-3 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white'>查詢預約</button>
      </form>

      <section className='mt-8 grid gap-3'>
        {!trimmedStudentId ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>
            請輸入預約成功後得到的學生 UUID 查詢紀錄。正式登入功能接上後，這裡會自動顯示登入學生的預約。
          </div>
        ) : bookings.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>目前查不到這個學生 UUID 的預約。</div>
        ) : (
          bookings.map((booking) => {
            const session = firstItem(booking.course_sessions);
            const course = firstItem(session?.courses);
            return (
              <article key={booking.id} className='rounded border bg-white p-5 shadow-sm'>
                <div className='flex flex-wrap justify-between gap-3'>
                  <div>
                    <h2 className='text-lg font-semibold'>{course?.title ?? '未設定課程'}</h2>
                    <p className='mt-1 text-sm text-slate-600'>上課時間：{formatDateTime(session?.start_time)}</p>
                    <p className='mt-1 text-sm text-slate-600'>狀態：{booking.status}</p>
                  </div>
                  {session?.zoom_join_url ? (
                    <a className='self-start rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white' href={session.zoom_join_url} rel='noreferrer' target='_blank'>
                      進入 Zoom
                    </a>
                  ) : (
                    <span className='self-start rounded bg-slate-100 px-3 py-2 text-sm text-slate-600'>尚未建立 Zoom 連結</span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
