import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: course } = await supabase
    .from('courses')
    .select('id,title,description,price,max_students,duration_minutes')
    .eq('id', id)
    .single();

  if (!course) return notFound();

  return (
    <main className='mx-auto max-w-3xl p-6'>
      <Link href='/' className='text-sm underline'>回課程列表</Link>
      <h1 className='mt-4 text-2xl font-bold'>{course.title}</h1>
      <p className='mt-2 text-gray-700'>{course.description ?? '尚無描述'}</p>
      <div className='mt-6 rounded-xl border p-4'>
        <p>時長：{course.duration_minutes} 分鐘</p>
        <p>價格：NT$ {course.price}</p>
        <p>名額上限：{course.max_students}</p>
      </div>
      <button className='mt-5 rounded bg-black px-4 py-2 text-white'>立即預約（下一步接 bookings）</button>
    </main>
  );
}
