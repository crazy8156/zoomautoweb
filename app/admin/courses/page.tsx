import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default async function AdminCoursesPage() {
  const { data } = await supabase
    .from('courses')
    .select('id,title,price,max_students,is_active,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>課程管理</h1>
        <Link href='/admin' className='text-sm underline'>回儀表板</Link>
      </header>
      <div className='space-y-3'>
        {(data ?? []).map((c) => (
          <div key={c.id} className='rounded-xl border p-4'>
            <h2 className='font-semibold'>{c.title}</h2>
            <p className='text-sm'>價格：NT$ {c.price}｜名額：{c.max_students}</p>
            <p className='text-sm'>狀態：{c.is_active ? '開放' : '關閉'}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
