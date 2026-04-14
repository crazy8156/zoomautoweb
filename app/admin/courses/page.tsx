import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '../../lib/admin';
import { Course, CourseSession, formatCurrency, formatDateTime } from '../../lib/domain';
import { supabase } from '../../lib/supabase';
import { createZoomMeeting } from '../../lib/zoom';

async function createCourse(formData: FormData) {
  'use server';

  await requireAdminSession();

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const price = Number(formData.get('price') ?? 0);
  const maxStudents = Number(formData.get('maxStudents') ?? 1);
  const durationMinutes = Number(formData.get('durationMinutes') ?? 60);
  const isActive = formData.get('isActive') === 'on';

  if (!title) throw new Error('請填寫課程名稱。');

  const { error } = await supabase.from('courses').insert({
    title,
    description: description || null,
    price,
    max_students: maxStudents,
    duration_minutes: durationMinutes,
    is_active: isActive,
  });

  if (error) throw new Error(`新增課程失敗：${error.message}`);
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/courses');
}

async function updateCourse(formData: FormData) {
  'use server';

  await requireAdminSession();

  const id = String(formData.get('courseId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const price = Number(formData.get('price') ?? 0);
  const maxStudents = Number(formData.get('maxStudents') ?? 1);
  const durationMinutes = Number(formData.get('durationMinutes') ?? 60);
  const isActive = formData.get('isActive') === 'on';

  if (!id || !title) throw new Error('請確認課程與名稱。');

  const { error } = await supabase
    .from('courses')
    .update({
      title,
      description: description || null,
      price,
      max_students: maxStudents,
      duration_minutes: durationMinutes,
      is_active: isActive,
    })
    .eq('id', id);

  if (error) throw new Error(`更新課程失敗：${error.message}`);
  revalidatePath('/');
  revalidatePath(`/course/${id}`);
  revalidatePath('/admin/courses');
}

async function createZoomSession(formData: FormData) {
  'use server';

  await requireAdminSession();

  const courseId = String(formData.get('courseId') ?? '');
  const courseTitle = String(formData.get('courseTitle') ?? 'Zoom 課程');
  const startTime = String(formData.get('startTime') ?? '');
  const durationMinutes = Number(formData.get('durationMinutes') ?? 60);

  if (!courseId || !startTime || !Number.isFinite(durationMinutes)) {
    throw new Error('請填寫課程、上課時間與課程長度。');
  }

  const meeting = await createZoomMeeting({
    topic: courseTitle,
    startTime,
    durationMinutes,
  });

  const { error } = await supabase.from('course_sessions').insert({
    course_id: courseId,
    start_time: startTime,
    zoom_join_url: meeting.join_url,
    zoom_meeting_id: meeting.id,
  });

  if (error) throw new Error(`Zoom 會議已建立，但寫入 Supabase 場次失敗：${error.message}`);

  revalidatePath('/');
  revalidatePath(`/course/${courseId}`);
  revalidatePath('/admin');
  revalidatePath('/admin/courses');
  revalidatePath('/admin/sessions');
}

export default async function AdminCoursesPage() {
  const { data } = await supabase
    .from('courses')
    .select('id,title,description,price,max_students,duration_minutes,is_active,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: sessions } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,zoom_join_url,zoom_meeting_id')
    .order('start_time', { ascending: false })
    .limit(200);

  const courses = (data ?? []) as Course[];
  const sessionsByCourse = ((sessions ?? []) as CourseSession[]).reduce<Record<string, CourseSession[]>>((groups, session) => {
    groups[session.course_id] ??= [];
    groups[session.course_id].push(session);
    return groups;
  }, {});

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>課程管理</h1>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin'>回儀表板</Link>
          <Link href='/'>前台</Link>
        </div>
      </header>

      <section className='rounded border bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold'>新增課程</h2>
        <form action={createCourse} className='mt-4 grid gap-4 md:grid-cols-6'>
          <label className='text-sm font-semibold md:col-span-3'>課程名稱<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='title' required /></label>
          <label className='text-sm font-semibold'>價格<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='0' name='price' type='number' defaultValue='0' /></label>
          <label className='text-sm font-semibold'>名額<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='1' name='maxStudents' type='number' defaultValue='10' /></label>
          <label className='text-sm font-semibold'>分鐘<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='15' name='durationMinutes' type='number' defaultValue='60' /></label>
          <label className='text-sm font-semibold md:col-span-6'>課程介紹<textarea className='mt-1 block min-h-24 w-full rounded border px-3 py-2 font-normal' name='description' /></label>
          <label className='flex items-center gap-2 text-sm font-semibold md:col-span-2'><input name='isActive' type='checkbox' defaultChecked />開放前台預約</label>
          <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white md:col-span-2'>新增課程</button>
        </form>
      </section>

      <section className='mt-8 grid gap-4'>
        {courses.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>目前還沒有課程。</div>
        ) : (
          courses.map((course) => (
            <article key={course.id} className='rounded border bg-white p-5 shadow-sm'>
              <form action={updateCourse} className='grid gap-4 md:grid-cols-6'>
                <input type='hidden' name='courseId' value={course.id} />
                <label className='text-sm font-semibold md:col-span-3'>課程名稱<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='title' defaultValue={course.title} required /></label>
                <label className='text-sm font-semibold'>價格<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='0' name='price' type='number' defaultValue={course.price} /></label>
                <label className='text-sm font-semibold'>名額<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='1' name='maxStudents' type='number' defaultValue={course.max_students} /></label>
                <label className='text-sm font-semibold'>分鐘<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='15' name='durationMinutes' type='number' defaultValue={course.duration_minutes ?? 60} /></label>
                <label className='text-sm font-semibold md:col-span-6'>課程介紹<textarea className='mt-1 block min-h-20 w-full rounded border px-3 py-2 font-normal' name='description' defaultValue={course.description ?? ''} /></label>
                <label className='flex items-center gap-2 text-sm font-semibold md:col-span-2'><input name='isActive' type='checkbox' defaultChecked={course.is_active} />開放前台預約</label>
                <p className='text-sm text-slate-600 md:col-span-2'>{formatCurrency(course.price)} / {course.max_students} 人</p>
                <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white md:col-span-2'>儲存課程</button>
              </form>

              <form action={createZoomSession} className='mt-5 grid gap-3 rounded bg-slate-50 p-4 md:grid-cols-4'>
                <input type='hidden' name='courseId' value={course.id} />
                <input type='hidden' name='courseTitle' value={course.title} />
                <label className='text-sm font-semibold md:col-span-2'>上課時間<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='startTime' required type='datetime-local' /></label>
                <label className='text-sm font-semibold'>分鐘<input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='15' name='durationMinutes' required type='number' defaultValue={course.duration_minutes ?? 60} /></label>
                <button className='self-end rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white'>建立 Zoom 場次</button>
              </form>

              <div className='mt-4 grid gap-2'>
                {(sessionsByCourse[course.id] ?? []).map((session) => (
                  <div key={session.id} className='flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm'>
                    <span>{formatDateTime(session.start_time)}</span>
                    {session.zoom_join_url ? <a className='font-semibold underline' href={session.zoom_join_url} target='_blank' rel='noreferrer'>Zoom 連結</a> : <span>尚未建立 Zoom</span>}
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

