import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '../../lib/admin';
import {
  createStudentRecord,
  deleteStudentRecord,
  readStudents,
  updateStudentRecord,
} from '../../lib/students';

function normalizeLessonCount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function createStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const courseName = String(formData.get('courseName') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const lessonCount = normalizeLessonCount(formData.get('lessonCount'));

  if (!name || !email || !courseName || !source) {
    throw new Error('請完整填寫名字、信箱、課程名稱與來源。');
  }

  await createStudentRecord({
    name,
    email,
    courseName,
    lessonCount,
    source,
  });

  revalidatePath('/admin/students');
}

async function updateStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const courseName = String(formData.get('courseName') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const lessonCount = normalizeLessonCount(formData.get('lessonCount'));

  if (!id || !name || !email || !courseName || !source) {
    throw new Error('請完整填寫名字、信箱、課程名稱與來源。');
  }

  await updateStudentRecord(id, {
    name,
    email,
    courseName,
    lessonCount,
    source,
  });

  revalidatePath('/admin/students');
}

async function deleteStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const id = String(formData.get('id') ?? '');
  if (!id) {
    throw new Error('找不到要刪除的學員。');
  }

  await deleteStudentRecord(id);
  revalidatePath('/admin/students');
}

export default async function AdminStudentsPage() {
  const students = await readStudents();

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>學員名單</h1>
          <p className='mt-2 text-sm text-slate-600'>管理名字、信箱、課程名稱、課程堂數與來源。</p>
        </div>
        <Link href='/admin' className='text-sm font-semibold underline'>回儀表板</Link>
      </header>

      <section className='rounded border bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold'>新增學員</h2>
        <form action={createStudent} className='mt-4 grid gap-4 md:grid-cols-5'>
          <label className='text-sm font-semibold'>
            名字
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='name' required />
          </label>
          <label className='text-sm font-semibold'>
            信箱 Email
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='email' required type='email' />
          </label>
          <label className='text-sm font-semibold'>
            課程名稱
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='courseName' required />
          </label>
          <label className='text-sm font-semibold'>
            課程堂數
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' min='0' name='lessonCount' required type='number' />
          </label>
          <label className='text-sm font-semibold'>
            來源
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='source' placeholder='網站 / Zalo / 介紹' required />
          </label>
          <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white md:col-span-1'>新增學員</button>
        </form>
      </section>

      <section className='mt-8 grid gap-4'>
        {students.length === 0 ? (
          <div className='rounded border border-dashed bg-white p-6 text-sm text-slate-600'>目前還沒有學員資料。</div>
        ) : (
          students.map((student) => (
            <article key={student.id} className='rounded border bg-white p-5 shadow-sm'>
              <form action={updateStudent} className='grid gap-4 md:grid-cols-6'>
                <input name='id' type='hidden' value={student.id} />
                <label className='text-sm font-semibold'>
                  名字
                  <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={student.name} name='name' required />
                </label>
                <label className='text-sm font-semibold'>
                  信箱 Email
                  <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={student.email} name='email' required type='email' />
                </label>
                <label className='text-sm font-semibold'>
                  課程名稱
                  <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={student.courseName} name='courseName' required />
                </label>
                <label className='text-sm font-semibold'>
                  課程堂數
                  <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={student.lessonCount} min='0' name='lessonCount' required type='number' />
                </label>
                <label className='text-sm font-semibold'>
                  來源
                  <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={student.source} name='source' required />
                </label>
                <div className='flex items-end gap-3'>
                  <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white' type='submit'>儲存修改</button>
                </div>
              </form>
              <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-slate-500'>
                <div>
                  <p>建立時間：{new Date(student.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                  <p>最後更新：{new Date(student.updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                </div>
                <form action={deleteStudent}>
                  <input name='id' type='hidden' value={student.id} />
                  <button className='rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-600' type='submit'>
                    刪除學員
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
