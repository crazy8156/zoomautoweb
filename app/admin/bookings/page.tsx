import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default async function AdminBookingsPage() {
  const { data } = await supabase
    .from('bookings')
    .select('id,status,booked_at,student_id,course_sessions:session_id(id,start_time,zoom_join_url,courses:course_id(title))')
    .order('booked_at', { ascending: false })
    .limit(50);

  const rows: any[] = data ?? [];

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>預約名單（含 Zoom）</h1>
        <Link href='/admin' className='text-sm underline'>回儀表板</Link>
      </header>

      <div className='space-y-3'>
        {rows.map((b) => (
          <div key={b.id} className='rounded-xl border p-4'>
            <p className='text-sm'>課程：{b.course_sessions?.courses?.title ?? '未設定'}</p>
            <p className='text-sm'>學生：{b.student_id}</p>
            <p className='text-sm'>上課時間：{b.course_sessions?.start_time ?? '未設定'}</p>
            <p className='text-sm'>狀態：{b.status}</p>
            <p className='text-sm'>
              Zoom：
              {b.course_sessions?.zoom_join_url ? (
                <a href={b.course_sessions.zoom_join_url} target='_blank' rel='noreferrer' className='underline'>
                  進入課程
                </a>
              ) : (
                ' 尚未建立'
              )}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
