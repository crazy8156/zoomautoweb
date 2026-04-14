import Link from 'next/link';

export default function MyBookingsPage() {
  return (
    <main className='mx-auto max-w-4xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>我的預約</h1>
        <Link href='/' className='text-sm underline'>回課程列表</Link>
      </header>
      <p className='text-sm text-gray-600'>下一步會接 Supabase Auth，顯示登入學生自己的 bookings。</p>
    </main>
  );
}
