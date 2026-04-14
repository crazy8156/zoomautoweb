import Link from 'next/link';
import { supabase } from '../../lib/supabase';

type StudentRow = {
  student_id: string;
};

export default async function AdminStudentsPage() {
  const { data } = await supabase.from('bookings').select('student_id').limit(500);
  const students = Array.from(new Set(((data ?? []) as StudentRow[]).map((row) => row.student_id))).sort();

  return (
    <main className='mx-auto max-w-5xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>學生名單</h1>
        </div>
        <Link href='/admin' className='text-sm font-semibold underline'>回儀表板</Link>
      </header>

      <div className='grid gap-3'>
        {students.length === 0 ? (
          <div className='rounded border border-dashed p-6 text-sm text-slate-600'>目前還沒有學生預約紀錄。</div>
        ) : (
          students.map((studentId) => (
            <Link key={studentId} className='rounded border bg-white p-4 text-sm font-semibold shadow-sm' href={`/my-bookings?studentId=${studentId}`}>
              {studentId}
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
