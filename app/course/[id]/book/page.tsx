import Link from 'next/link';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Course, CourseSession, firstItem, formatCurrency, formatDateTime, uuidFromEmail } from '../../../lib/domain';
import { supabase } from '../../../lib/supabase';

async function createBooking(formData: FormData) {
  'use server';

  const sessionId = String(formData.get('sessionId') ?? '');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const explicitStudentId = String(formData.get('studentId') ?? '').trim();
  const studentId = explicitStudentId || (email ? uuidFromEmail(email) : randomUUID());

  if (!sessionId) throw new Error('找不到可預約場次。');

  const { error } = await supabase.from('bookings').insert({
    session_id: sessionId,
    student_id: studentId,
    status: 'confirmed',
  });

  if (error) {
    throw new Error(`預約失敗：${error.message}`);
  }

  revalidatePath('/my-bookings');
  redirect(`/my-bookings?studentId=${encodeURIComponent(studentId)}`);
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
    .select('id,course_id,start_time,zoom_join_url,courses:course_id(title,duration_minutes,price)')
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
            <label className='block text-sm font-semibold'>
              Email
              <input
                className='mt-1 block w-full rounded border px-3 py-2 font-normal'
                name='email'
                placeholder='student@example.com'
                type='email'
              />
            </label>
            <label className='block text-sm font-semibold'>
              已有學生 UUID 可填，沒有可留空
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='studentId' placeholder='留空會自動產生查詢用 ID' />
            </label>
            <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white'>確認預約</button>
          </form>
        ) : (
          <p className='mt-6 rounded border border-dashed p-4 text-sm text-slate-600'>目前沒有可預約場次。</p>
        )}
      </section>
    </main>
  );
}
