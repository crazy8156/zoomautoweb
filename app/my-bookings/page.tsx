import Link from 'next/link';
import { cookies } from 'next/headers';
import { Booking, CourseSession, firstItem, formatDateTime } from '../lib/domain';
import { supabase } from '../lib/supabase';
import { STUDENT_COOKIE_NAME, verifyStudentAccessToken } from '../lib/student-access';

type BookingWithSession = Booking & {
  course_sessions: CourseSession | CourseSession[] | null;
};

export default async function MyBookingsPage() {
  const cookieStore = await cookies();
  const studentId = verifyStudentAccessToken(cookieStore.get(STUDENT_COOKIE_NAME)?.value);

  const { data } = studentId
    ? await supabase
        .from('bookings')
        .select('id,status,booked_at,student_id,session_id,course_sessions:session_id(id,start_time,zoom_join_url,courses:course_id(title,duration_minutes,price,max_students))')
        .eq('student_id', studentId)
        .order('booked_at', { ascending: false })
        .limit(50)
    : { data: [] };

  const bookings = (data ?? []) as unknown as BookingWithSession[];
  const hasBookings = bookings.length > 0;

  return (
    <main className='mx-auto max-w-5xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Student</p>
          <h1 className='text-3xl font-bold'>我的課程</h1>
          <p className='mt-2 text-sm text-slate-600'>這裡只顯示這個裝置預約過的課程與 Zoom 上課連結。</p>
        </div>
        <Link href='/' className='text-sm font-semibold underline'>回課程列表</Link>
      </header>

      {!studentId ? (
        <div className='rounded border border-dashed bg-white p-8 text-sm leading-7 text-slate-600'>
          目前這個瀏覽器還沒有學生入口。請先從課程頁完成預約，系統會自動幫您建立「我的課程」入口。
        </div>
      ) : !hasBookings ? (
        <div className='rounded border border-dashed bg-white p-8 text-sm leading-7 text-slate-600'>
          目前還沒有預約紀錄。完成第一堂課預約後，這裡就會顯示 Zoom 上課連結與場次時間。
        </div>
      ) : (
        <section className='grid gap-4'>
          {bookings.map((booking) => {
            const session = firstItem(booking.course_sessions);
            const course = firstItem(session?.courses);

            return (
              <article key={booking.id} className='rounded border bg-white p-5 shadow-sm'>
                <div className='flex flex-wrap items-start justify-between gap-4'>
                  <div className='space-y-2'>
                    <h2 className='text-xl font-semibold'>{course?.title ?? '未設定課程'}</h2>
                    <p className='text-sm text-slate-600'>上課時間：{formatDateTime(session?.start_time)}</p>
                    <p className='text-sm text-slate-600'>預約狀態：{booking.status}</p>
                    <p className='text-sm text-slate-600'>預約建立時間：{formatDateTime(booking.booked_at)}</p>
                  </div>
                  {session?.zoom_join_url ? (
                    <a
                      className='rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white'
                      href={session.zoom_join_url}
                      rel='noreferrer'
                      target='_blank'
                    >
                      進入 Zoom 教室
                    </a>
                  ) : (
                    <span className='rounded bg-slate-100 px-3 py-2 text-sm text-slate-600'>尚未建立 Zoom 連結</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
