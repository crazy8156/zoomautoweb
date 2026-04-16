import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Course, CourseSession, firstItem, formatCurrency, formatDateTime } from '../../../lib/domain';
import { supabase } from '../../../lib/supabase';
import {
  createStudentAccessToken,
  createStudentId,
  studentCookieOptions,
  STUDENT_COOKIE_NAME,
  verifyStudentAccessToken,
} from '../../../lib/student-access';

async function createBooking(formData: FormData) {
  'use server';

  const sessionId = String(formData.get('sessionId') ?? '');
  if (!sessionId) throw new Error('找不到可預約場次。');

  const cookieStore = await cookies();
  const studentId = verifyStudentAccessToken(cookieStore.get(STUDENT_COOKIE_NAME)?.value) ?? createStudentId();

  const { data: session, error: sessionError } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,courses:course_id(id,title,max_students)')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(`查詢場次失敗：${sessionError.message}`);
  if (!session) throw new Error('找不到對應的課程場次。');

  const course = firstItem(
    session.courses as
      | { id: string; title: string; max_students: number }
      | { id: string; title: string; max_students: number }[]
      | null,
  );
  const maxStudents = course?.max_students ?? 1;

  const { count, error: countError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  if (countError) throw new Error(`查詢場次名額失敗：${countError.message}`);
  if ((count ?? 0) >= maxStudents) throw new Error('這個場次已滿額，請選擇其他上課時間。');

  const { data: existingBooking, error: existingBookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existingBookingError) throw new Error(`查詢既有預約失敗：${existingBookingError.message}`);

  if (!existingBooking?.id) {
    const { error } = await supabase.from('bookings').insert({
      session_id: sessionId,
      student_id: studentId,
      status: 'confirmed',
    });

    if (error) throw new Error(`預約失敗：${error.message}`);
  }

  cookieStore.set(STUDENT_COOKIE_NAME, createStudentAccessToken(studentId), studentCookieOptions());
  revalidatePath('/my-bookings');
  redirect('/my-bookings');
}

export default async function BookCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { id } = await params;
  const { sessionId } = await searchParams;

  const { data: course } = await supabase
    .from('courses')
    .select('id,title,description,price,max_students,duration_minutes,is_active,created_at')
    .eq('id', id)
    .single();

  const { data: sessions } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,zoom_join_url,courses:course_id(title,duration_minutes,price,max_students)')
    .eq('course_id', id)
    .order('start_time', { ascending: true });

  const row = course as Course | null;
  const sessionRows = (sessions ?? []) as CourseSession[];
  const selectedSession = sessionRows.find((session) => session.id === sessionId) ?? sessionRows[0] ?? null;
  const relatedCourse = firstItem(selectedSession?.courses);

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <Link href={`/course/${id}`} className='text-sm font-semibold underline'>回課程詳情</Link>
      <section className='mt-6 rounded border bg-white p-6 shadow-sm'>
        <p className='text-sm font-semibold text-emerald-700'>Booking</p>
        <h1 className='mt-2 text-3xl font-bold'>預約課程</h1>
        <div className='mt-5 rounded bg-slate-50 p-4 text-sm leading-7'>
          <p><span className='font-semibold'>課程：</span>{row?.title ?? relatedCourse?.title ?? '未設定'}</p>
          <p><span className='font-semibold'>時間：</span>{formatDateTime(selectedSession?.start_time)}</p>
          <p><span className='font-semibold'>時長：</span>{row?.duration_minutes ?? relatedCourse?.duration_minutes ?? 60} 分鐘</p>
          <p><span className='font-semibold'>價格：</span>{formatCurrency(row?.price ?? relatedCourse?.price ?? 0)}</p>
        </div>

        {selectedSession ? (
          <form action={createBooking} className='mt-6 space-y-4'>
            <input type='hidden' name='sessionId' value={selectedSession.id} />
            <div className='rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900'>
              預約成功後，這個瀏覽器會自動保存您的學生入口。之後可直接從「我的課程」查看 Zoom 上課連結。
            </div>
            <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white'>確認預約</button>
          </form>
        ) : (
          <p className='mt-6 rounded border border-dashed p-4 text-sm text-slate-600'>目前沒有可預約場次。</p>
        )}
      </section>
    </main>
  );
}
