import Link from 'next/link';
import { requireAdminSession } from '../../lib/admin';
import { Booking, CourseSession, firstItem, formatDateTime } from '../../lib/domain';
import { supabase } from '../../lib/supabase';

type BookingWithSession = Booking & {
  course_sessions: CourseSession | CourseSession[] | null;
};

export default async function AdminBookingsPage() {
  await requireAdminSession();

  const { data } = await supabase
    .from('bookings')
    .select('id,status,booked_at,student_id,session_id,course_sessions:session_id(id,start_time,zoom_join_url,courses:course_id(title,duration_minutes,price))')
    .order('booked_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as BookingWithSession[];
  const now = new Date();
  const studentMap = new Map<
    string,
    {
      studentId: string;
      courseTitles: Set<string>;
      totalLessons: number;
      remainingLessons: number;
      lastBookingAt?: string;
    }
  >();

  rows.forEach((booking) => {
    const session = firstItem(booking.course_sessions);
    const course = firstItem(session?.courses);
    const title = course?.title ?? '未設定課程';
    const startAt = session?.start_time ? new Date(session.start_time) : null;
    const isUpcoming = startAt ? startAt.getTime() >= now.getTime() : false;

    const current = studentMap.get(booking.student_id) ?? {
      studentId: booking.student_id,
      courseTitles: new Set<string>(),
      totalLessons: 0,
      remainingLessons: 0,
      lastBookingAt: booking.booked_at,
    };

    current.courseTitles.add(title);
    current.totalLessons += 1;
    if (isUpcoming) current.remainingLessons += 1;
    if (!current.lastBookingAt || booking.booked_at > current.lastBookingAt) current.lastBookingAt = booking.booked_at;

    studentMap.set(booking.student_id, current);
  });

  const students = Array.from(studentMap.values()).sort((a, b) => (a.lastBookingAt ?? '').localeCompare(b.lastBookingAt ?? '')).reverse();

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>老師後台 / 課程中心</p>
          <h1 className='text-3xl font-bold'>學員預約紀錄</h1>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin/course-center'>回課程中心</Link>
          <Link href='/admin/students'>課程學員頁</Link>
        </div>
      </header>

      <div className='grid gap-3'>
        {students.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>目前還沒有學員資料。</div>
        ) : (
          students.map((student) => {
            const displayName = `學員-${student.studentId.slice(0, 8)}`;
            return (
              <article key={student.studentId} className='rounded border bg-white p-5 shadow-sm'>
                <div className='grid gap-3 md:grid-cols-6'>
                  <div>
                    <p className='text-sm text-slate-500'>名字</p>
                    <p className='font-semibold'>{displayName}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>信箱</p>
                    <p className='font-semibold text-slate-400'>請到課程學員頁查看</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>課程</p>
                    <p className='font-semibold'>{Array.from(student.courseTitles).join('、')}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>剩餘堂數</p>
                    <p className='font-semibold'>{student.remainingLessons}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>總堂數</p>
                    <p className='font-semibold'>{student.totalLessons}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>來源</p>
                    <p className='font-semibold'>網站預約</p>
                  </div>
                </div>
                <div className='mt-4 flex flex-wrap gap-3 text-sm font-semibold'>
                  <span className='text-slate-500'>最近預約：{formatDateTime(student.lastBookingAt)}</span>
                  <Link className='underline' href='/admin/students'>
                    查看課程學員頁
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}
