import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { supabase } from '../../lib/supabase';
import { createZoomMeeting } from '../../lib/zoom';

type Course = {
  id: string;
  title: string;
  price: number;
  max_students: number;
  is_active: boolean;
  created_at: string;
};

type CourseSession = {
  id: string;
  course_id: string;
  start_time: string;
  zoom_join_url: string | null;
};

async function createZoomSession(formData: FormData) {
  'use server';

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
  });

  if (error) {
    throw new Error(`Zoom 會議已建立，但寫入 Supabase 場次失敗：${error.message}`);
  }

  revalidatePath('/admin/courses');
}

export default async function AdminCoursesPage() {
  const { data } = await supabase
    .from('courses')
    .select('id,title,price,max_students,is_active,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: sessions } = await supabase
    .from('course_sessions')
    .select('id,course_id,start_time,zoom_join_url')
    .order('start_time', { ascending: false })
    .limit(200);

  const sessionsByCourse = (sessions as CourseSession[] | null ?? []).reduce<
    Record<string, CourseSession[]>
  >((groups, session) => {
    groups[session.course_id] ??= [];
    groups[session.course_id].push(session);
    return groups;
  }, {});

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>課程管理</h1>
        <Link href='/admin' className='text-sm underline'>回儀表板</Link>
      </header>
      <div className='space-y-3'>
        {((data ?? []) as Course[]).map((c) => (
          <div key={c.id} className='rounded-xl border p-4'>
            <h2 className='font-semibold'>{c.title}</h2>
            <p className='text-sm'>價格：NT$ {c.price}｜名額：{c.max_students}</p>
            <p className='text-sm'>狀態：{c.is_active ? '開放' : '關閉'}</p>

            <form action={createZoomSession} className='mt-4 grid gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-4'>
              <input type='hidden' name='courseId' value={c.id} />
              <input type='hidden' name='courseTitle' value={c.title} />
              <label className='text-sm md:col-span-2'>
                上課時間
                <input
                  className='mt-1 block w-full rounded border px-3 py-2'
                  name='startTime'
                  required
                  type='datetime-local'
                />
              </label>
              <label className='text-sm'>
                分鐘
                <input
                  className='mt-1 block w-full rounded border px-3 py-2'
                  min='15'
                  name='durationMinutes'
                  required
                  type='number'
                  defaultValue='60'
                />
              </label>
              <button className='self-end rounded bg-black px-3 py-2 text-sm text-white'>
                建立 Zoom 場次
              </button>
            </form>

            <div className='mt-4 space-y-2'>
              {(sessionsByCourse[c.id] ?? []).map((session) => (
                <div key={session.id} className='rounded border px-3 py-2 text-sm'>
                  <p>上課時間：{session.start_time}</p>
                  <p>
                    Zoom：
                    {session.zoom_join_url ? (
                      <a
                        className='underline'
                        href={session.zoom_join_url}
                        rel='noreferrer'
                        target='_blank'
                      >
                        進入課程
                      </a>
                    ) : (
                      ' 尚未建立'
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
