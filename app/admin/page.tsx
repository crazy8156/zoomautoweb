import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default async function AdminPage() {
  const { count: courseCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });

  const { count: bookingCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>老師後台｜儀表板（Supabase）</h1>
        <Link href='/' className='text-sm underline'>前台</Link>
      </header>
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='rounded-xl border p-4'><p className='text-sm text-gray-500'>課程數</p><p className='text-2xl font-bold'>{courseCount ?? 0}</p></div>
        <div className='rounded-xl border p-4'><p className='text-sm text-gray-500'>預約數</p><p className='text-2xl font-bold'>{bookingCount ?? 0}</p></div>
      </div>
    </main>
  );
}
