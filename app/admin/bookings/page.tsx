import Link from 'next/link';
import { Booking, CourseSession, firstItem, formatDateTime } from '../../lib/domain';
import { supabase } from '../../lib/supabase';

type BookingWithSession = Booking & {
  course_sessions: CourseSession | CourseSession[] | null;
};

export default async function AdminBookingsPage() {
  const { data } = await supabase
    .from('bookings')
    .select('id,status,booked_at,student_id,session_id,course_sessions:session_id(id,start_time,zoom_join_url,courses:course_id(title,duration_minutes,price))')
    .order('booked_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as BookingWithSession[];

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>預約名單</h1>
        </div>
        <Link href='/admin' className='text-sm font-semibold underline'>回儀表板</Link>
      </header>

      <div className='grid gap-3'>
        {rows.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>目前還沒有預約。</div>
        ) : (
          rows.map((booking) => {
            const session = firstItem(booking.course_sessions);
            const course = firstItem(session?.courses);
            return (
              <article key={booking.id} className='rounded border bg-white p-5 shadow-sm'>
                <div className='grid gap-3 md:grid-cols-4'>
                  <div>
                    <p className='text-sm text-slate-500'>課程</p>
                    <p className='font-semibold'>{course?.title ?? '未設定課程'}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>學生 UUID</p>
                    <p className='break-all text-sm font-semibold'>{booking.student_id}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>上課時間</p>
                    <p className='font-semibold'>{formatDateTime(session?.start_time)}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>狀態</p>
                    <p className='font-semibold'>{booking.status}</p>
                  </div>
                </div>
                <div className='mt-4 flex flex-wrap gap-3 text-sm font-semibold'>
                  {session?.zoom_join_url ? <a className='underline' href={session.zoom_join_url} target='_blank' rel='noreferrer'>Zoom 連結</a> : <span className='text-slate-500'>尚未建立 Zoom 連結</span>}
                  <Link className='underline' href={`/my-bookings?studentId=${booking.student_id}`}>查看學生頁</Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
