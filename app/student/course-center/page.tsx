import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Booking, Course, CourseSession, firstItem, formatBookingStatus, formatCurrency, formatDateTime } from '../../lib/domain';
import { getJaeasyMemberProfile, JAEASY_COOKIE_NAME, verifyJaeasySessionToken } from '../../lib/jaeasy-auth';
import { STUDENT_COOKIE_NAME, verifyStudentAccessToken } from '../../lib/student-access';
import { getStudentZoomJoinUrlMap } from '../../lib/student-zoom';
import { supabase } from '../../lib/supabase';

type BookingWithSession = Booking & {
  course_sessions: CourseSession | CourseSession[] | null;
};

export default async function StudentCourseCenterPage() {
  const cookieStore = await cookies();
  const session = verifyJaeasySessionToken(cookieStore.get(JAEASY_COOKIE_NAME)?.value);

  if (!session) {
    redirect('/jaeasy/login?next=/student/course-center');
  }

  const member = await getJaeasyMemberProfile(session.userId, session.email);
  if (!member) {
    redirect('/jaeasy/login?next=/student/course-center');
  }

  const bookingStudentId = verifyStudentAccessToken(cookieStore.get(STUDENT_COOKIE_NAME)?.value);

  const [{ data: courses }, bookingQuery] = await Promise.all([
    supabase
      .from('courses')
      .select('id,title,description,price,max_students,duration_minutes,is_active,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
    bookingStudentId
      ? supabase
          .from('bookings')
          .select(
            'id,status,booked_at,student_id,session_id,course_sessions:session_id(id,start_time,zoom_join_url,zoom_meeting_id,courses:course_id(title,duration_minutes,price,max_students))',
          )
          .eq('student_id', bookingStudentId)
          .order('booked_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const liveCourses = (courses ?? []) as Course[];
  const bookings = ((bookingQuery as { data: BookingWithSession[] | null }).data ?? []) as BookingWithSession[];
  const studentZoomJoinUrlMap = await getStudentZoomJoinUrlMap(
    bookingStudentId,
    bookings.map((booking) => firstItem(booking.course_sessions)?.zoom_meeting_id),
  );

  return (
    <main className='min-h-full bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_46%,#e7eefb_100%)] px-5 py-10 md:px-8 md:py-14'>
      <div className='mx-auto max-w-7xl'>
        <header className='rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.2em] text-sky-700'>學生課程中心</p>
              <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl'>課程與上課入口</h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡會整理您目前已預約的課程、對應的 Zoom 連結，以及可繼續預約的新課程。
              </p>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/student'
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回學生中心
              </Link>
              <Link
                href='/my-bookings'
                className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'
              >
                查看我的預約
              </Link>
            </div>
          </div>
          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <MetricCard label='目前會員' value={member.fullName || session.fullName || member.email} />
            <MetricCard label='已建立課程入口' value={`${bookings.length} 筆`} />
            <MetricCard label='可預約課程' value={`${liveCourses.length} 門`} />
          </div>
        </header>

        <section className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]'>
          <div className='grid gap-5'>
            <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>我的 Zoom 課程</p>
                  <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>已預約的上課入口</h2>
                </div>
                <Link href='/my-bookings' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                  查看完整清單
                </Link>
              </div>
              <div className='mt-6 grid gap-4'>
                {bookings.length > 0 ? (
                  bookings.map((booking) => {
                    const sessionRow = firstItem(booking.course_sessions);
                    const course = firstItem(sessionRow?.courses);
                    const zoomMeetingId = String(sessionRow?.zoom_meeting_id ?? '').trim();
                    const personalizedJoinUrl = zoomMeetingId ? studentZoomJoinUrlMap.get(zoomMeetingId) ?? null : null;
                    const effectiveJoinUrl = personalizedJoinUrl ?? sessionRow?.zoom_join_url ?? null;

                    return (
                      <article key={booking.id} className='rounded-3xl bg-slate-50 p-5'>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                          <div>
                            <p className='text-lg font-black tracking-tight text-slate-950'>{course?.title ?? '未命名課程'}</p>
                            <p className='mt-2 text-sm leading-7 text-slate-600'>上課時間：{formatDateTime(sessionRow?.start_time)}</p>
                            <p className='text-sm leading-7 text-slate-600'>預約狀態：{formatBookingStatus(booking.status)}</p>
                            <p className='text-sm leading-7 text-slate-600'>
                              連結類型：{personalizedJoinUrl ? '學生專屬 Zoom 連結' : '一般課程連結'}
                            </p>
                          </div>
                          {effectiveJoinUrl ? (
                            <a
                              href={effectiveJoinUrl}
                              target='_blank'
                              rel='noreferrer'
                              className='inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white'
                            >
                              進入 Zoom 教室
                            </a>
                          ) : (
                            <span className='rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600'>尚未建立 Zoom 連結</span>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                    目前還沒有已建立的上課入口。完成第一筆預約後，這裡就會自動出現您的 Zoom 課程連結。
                  </div>
                )}
              </div>
            </article>

            <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>可預約課程</p>
                  <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>繼續安排你的學習</h2>
                </div>
                <Link href='/student' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                  回學習總覽
                </Link>
              </div>
              <div className='mt-6 grid gap-4'>
                {liveCourses.length > 0 ? (
                  liveCourses.map((course) => (
                    <article key={course.id} className='rounded-3xl border border-slate-200 p-5'>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <p className='text-xl font-black tracking-tight text-slate-950'>{course.title}</p>
                          <p className='mt-2 text-sm leading-7 text-slate-600'>
                            {course.description ?? '這門課程目前尚未提供課程說明，您可以先查看詳情頁了解安排。'}
                          </p>
                        </div>
                        <span className='rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700'>
                          {formatCurrency(course.price)}
                        </span>
                      </div>
                      <div className='mt-5 flex flex-wrap gap-3 text-sm text-slate-600'>
                        <span className='rounded-full bg-slate-100 px-3 py-2'>時長 {course.duration_minutes ?? 60} 分鐘</span>
                        <span className='rounded-full bg-slate-100 px-3 py-2'>名額 {course.max_students} 人</span>
                      </div>
                      <div className='mt-5 flex flex-wrap gap-3'>
                        <Link
                          href={`/course/${course.id}`}
                          className='inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white'
                        >
                          查看課程
                        </Link>
                        <Link
                          href={`/course/${course.id}/book`}
                          className='inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50'
                        >
                          立即預約
                        </Link>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                    目前沒有開放中的課程。之後有新課程上架時，這裡會直接顯示可預約內容。
                  </div>
                )}
              </div>
            </article>
          </div>

          <aside className='rounded-[2rem] bg-[linear-gradient(180deg,#0f172a_0%,#1d4ed8_100%)] p-7 text-white shadow-[0_28px_70px_rgba(15,23,42,0.24)]'>
            <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>使用提醒</p>
            <h2 className='mt-4 text-2xl font-black tracking-tight'>上課前先做這兩件事</h2>
            <div className='mt-6 grid gap-3 text-sm leading-7 text-sky-50/92'>
              <div className='rounded-3xl border border-white/12 bg-white/10 p-4'>
                <p className='font-black text-white'>先確認設備</p>
                <p className='mt-2'>上課前先檢查麥克風、耳機與網路，避免進教室後才臨時處理。</p>
              </div>
              <div className='rounded-3xl border border-white/12 bg-white/10 p-4'>
                <p className='font-black text-white'>提前打開連結</p>
                <p className='mt-2'>建議至少提早 5 分鐘進入 Zoom，讓課程可以準時開始。</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-5'>
      <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{label}</p>
      <p className='mt-3 text-xl font-black tracking-tight text-slate-950'>{value}</p>
    </article>
  );
}
