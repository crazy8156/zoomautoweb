import Link from 'next/link';
import { supabase } from '../../lib/supabase';

type BookingRow = {
  id: string;
  status: string;
  student_id: string;
  session: BookingSession | null;
};

type RawBookingRow = {
  id: string;
  status: string;
  student_id: string;
  course_sessions: BookingSession | BookingSession[] | null;
};

type BookingSession = {
  start_time: string | null;
  zoom_join_url: string | null;
  courses: BookingCourse | BookingCourse[] | null;
};

type BookingCourse = {
  title: string | null;
};

function firstItem<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeBooking(row: RawBookingRow): BookingRow {
  return {
    id: row.id,
    status: row.status,
    student_id: row.student_id,
    session: firstItem(row.course_sessions),
  };
}

function getCourseTitle(session: BookingSession | null) {
  return firstItem(session?.courses ?? null)?.title ?? '未設定';
}

function getStartTime(session: BookingSession | null) {
  return session?.start_time ?? '未設定';
}

function getZoomJoinUrl(session: BookingSession | null) {
  return session?.zoom_join_url ?? null;
}

export default async function AdminBookingsPage() {
  const { data } = await supabase
    .from('bookings')
    .select('id,status,booked_at,student_id,course_sessions:session_id(id,start_time,zoom_join_url,courses:course_id(title))')
    .order('booked_at', { ascending: false })
    .limit(50);

  const rows = ((data ?? []) as unknown as RawBookingRow[]).map(normalizeBooking);

  return (
    <main className='mx-auto max-w-5xl p-6'>
      <header className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-bold'>預約名單（含 Zoom）</h1>
        <Link href='/admin' className='text-sm underline'>回儀表板</Link>
      </header>

      <div className='space-y-3'>
        {rows.map((b) => (
          <div key={b.id} className='rounded-xl border p-4'>
            <p className='text-sm'>課程：{getCourseTitle(b.session)}</p>
            <p className='text-sm'>學生：{b.student_id}</p>
            <p className='text-sm'>上課時間：{getStartTime(b.session)}</p>
            <p className='text-sm'>狀態：{b.status}</p>
            <p className='text-sm'>
              Zoom：
              {getZoomJoinUrl(b.session) ? (
                <a href={getZoomJoinUrl(b.session) ?? ''} target='_blank' rel='noreferrer' className='underline'>
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
