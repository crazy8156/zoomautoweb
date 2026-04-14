import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default async function AdminPage() {
  const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
  const { count: sessionCount } = await supabase.from('course_sessions').select('*', { count: 'exact', head: true });
  const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });

  const cards = [
    { label: '課程數', value: courseCount ?? 0, href: '/admin/courses' },
    { label: '場次數', value: sessionCount ?? 0, href: '/admin/sessions' },
    { label: '預約數', value: bookingCount ?? 0, href: '/admin/bookings' },
  ];

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>老師後台</h1>
        </div>
        <Link href='/' className='text-sm font-semibold underline'>前台</Link>
      </header>

      <div className='grid gap-4 md:grid-cols-3'>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className='rounded border bg-white p-5 shadow-sm'>
            <p className='text-sm text-slate-500'>{card.label}</p>
            <p className='mt-2 text-3xl font-bold'>{card.value}</p>
          </Link>
        ))}
      </div>

      <section className='mt-8 rounded border bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold'>管理工作</h2>
        <div className='mt-4 grid gap-3 md:grid-cols-3'>
          <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/courses'>課程管理</Link>
          <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/sessions'>場次管理</Link>
          <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/bookings'>預約名單</Link>
        </div>
      </section>
    </main>
  );
}
