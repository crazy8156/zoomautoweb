import Link from 'next/link';
import { supabase } from './lib/supabase';

type Course = {
  id: string;
  title: string;
  price: number;
  max_students: number;
};

export default async function HomePage() {
  const { data: courses } = await supabase
    .from('courses')
    .select('id,title,price,max_students,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30);

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>學生前台｜課程列表（Supabase）</h1>
        <div className='space-x-4 text-sm'>
          <Link className='underline' href='/my-bookings'>我的預約</Link>
          <Link className='underline' href='/admin'>老師後台</Link>
        </div>
      </header>

      <div className='grid gap-4 md:grid-cols-2'>
        {(courses as Course[] | null)?.map((c) => (
          <article key={c.id} className='rounded-xl border p-4 shadow-sm'>
            <h2 className='text-lg font-semibold'>{c.title}</h2>
            <p className='mt-1 text-sm'>價格：NT\$ {c.price}</p>
            <p className='mt-1 text-sm'>名額上限：{c.max_students}</p>
            <Link href={'/course/' + c.id} className='mt-3 inline-block rounded bg-black px-3 py-2 text-sm text-white'>
              查看詳情
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
