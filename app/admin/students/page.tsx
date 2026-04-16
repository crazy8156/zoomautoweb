import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '../../lib/admin';
import { supabaseAdmin } from '../../lib/supabase-admin';

type CourseOption = {
  id: string;
  title: string;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  source: string;
  created_at: string;
  updated_at: string;
  student_course_enrollments:
    | {
        id: string;
        course_id: string;
        lesson_count: number;
        remaining_lessons: number;
        status: string;
        courses: { title: string } | { title: string }[] | null;
      }[]
    | null;
};

function firstItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizeLessonCount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function createStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const courseId = String(formData.get('courseId') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const lessonCount = normalizeLessonCount(formData.get('lessonCount'));

  if (!name || !email || !courseId || !source) {
    throw new Error('請完整填寫名字、信箱、課程名稱與來源。');
  }

  const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingStudentError) {
    throw new Error(`查詢學員失敗：${existingStudentError.message}`);
  }

  let studentId = existingStudent?.id ?? '';

  if (!studentId) {
    const { data: createdStudent, error: createStudentError } = await supabaseAdmin
      .from('students')
      .insert({ name, email, source })
      .select('id')
      .single();

    if (createStudentError) {
      throw new Error(`新增學員失敗：${createStudentError.message}`);
    }

    studentId = createdStudent.id;
  } else {
    const { error: updateStudentError } = await supabaseAdmin
      .from('students')
      .update({ name, email, source })
      .eq('id', studentId);

    if (updateStudentError) {
      throw new Error(`更新既有學員失敗：${updateStudentError.message}`);
    }
  }

  const { error: upsertEnrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .upsert(
      {
        student_id: studentId,
        course_id: courseId,
        lesson_count: lessonCount,
        remaining_lessons: lessonCount,
        status: 'active',
      },
      { onConflict: 'student_id,course_id' },
    );

  if (upsertEnrollmentError) {
    throw new Error(`新增課程堂數失敗：${upsertEnrollmentError.message}`);
  }

  revalidatePath('/admin/students');
}

async function updateStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const studentId = String(formData.get('studentId') ?? '').trim();
  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const courseId = String(formData.get('courseId') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const lessonCount = normalizeLessonCount(formData.get('lessonCount'));

  if (!studentId || !enrollmentId || !name || !email || !courseId || !source) {
    throw new Error('請完整填寫學員資料。');
  }

  const { error: updateStudentError } = await supabaseAdmin
    .from('students')
    .update({ name, email, source })
    .eq('id', studentId);

  if (updateStudentError) {
    throw new Error(`更新學員失敗：${updateStudentError.message}`);
  }

  const { error: updateEnrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .update({
      course_id: courseId,
      lesson_count: lessonCount,
      remaining_lessons: lessonCount,
    })
    .eq('id', enrollmentId);

  if (updateEnrollmentError) {
    throw new Error(`更新課程堂數失敗：${updateEnrollmentError.message}`);
  }

  revalidatePath('/admin/students');
}

async function deleteStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const studentId = String(formData.get('studentId') ?? '').trim();
  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();

  if (!studentId || !enrollmentId) {
    throw new Error('找不到要刪除的學員。');
  }

  const { error: deleteEnrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .delete()
    .eq('id', enrollmentId);

  if (deleteEnrollmentError) {
    throw new Error(`刪除課程堂數失敗：${deleteEnrollmentError.message}`);
  }

  const { count, error: remainingError } = await supabaseAdmin
    .from('student_course_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);

  if (remainingError) {
    throw new Error(`查詢剩餘課程失敗：${remainingError.message}`);
  }

  if ((count ?? 0) === 0) {
    const { error: deleteStudentError } = await supabaseAdmin.from('students').delete().eq('id', studentId);
    if (deleteStudentError) {
      throw new Error(`刪除學員失敗：${deleteStudentError.message}`);
    }
  }

  revalidatePath('/admin/students');
}

export default async function AdminStudentsPage() {
  await requireAdminSession();

  const [{ data: studentsData, error: studentsError }, { data: coursesData, error: coursesError }] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id,name,email,source,created_at,updated_at,student_course_enrollments(id,course_id,lesson_count,remaining_lessons,status,courses(title))')
      .order('updated_at', { ascending: false }),
    supabaseAdmin.from('courses').select('id,title').order('title', { ascending: true }),
  ]);

  if (studentsError) {
    throw new Error(`讀取學員資料失敗：${studentsError.message}`);
  }

  if (coursesError) {
    throw new Error(`讀取課程清單失敗：${coursesError.message}`);
  }

  const students = ((studentsData ?? []) as StudentRow[]).flatMap((student) => {
    const enrollments = student.student_course_enrollments ?? [];
    if (enrollments.length === 0) {
      return [
        {
          studentId: student.id,
          enrollmentId: '',
          name: student.name,
          email: student.email,
          courseId: '',
          courseName: '',
          lessonCount: 0,
          source: student.source,
          createdAt: student.created_at,
          updatedAt: student.updated_at,
        },
      ];
    }

    return enrollments.map((enrollment) => ({
      studentId: student.id,
      enrollmentId: enrollment.id,
      name: student.name,
      email: student.email,
      courseId: enrollment.course_id,
      courseName: firstItem(enrollment.courses)?.title ?? '',
      lessonCount: enrollment.lesson_count,
      source: student.source,
      createdAt: student.created_at,
      updatedAt: student.updated_at,
    }));
  });

  const courses = (coursesData ?? []) as CourseOption[];

  return (
    <main className='mx-auto max-w-6xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>Admin</p>
          <h1 className='text-3xl font-bold'>學員名單</h1>
          <p className='mt-2 text-sm text-slate-600'>直接寫入 Supabase 的學員資料、課程堂數與來源。</p>
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
            <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='courseId' required>
              <option value=''>請選擇課程</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
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
            <article key={`${student.studentId}-${student.enrollmentId || 'profile'}`} className='rounded border bg-white p-5 shadow-sm'>
              <form action={updateStudent} className='grid gap-4 md:grid-cols-6'>
                <input name='studentId' type='hidden' value={student.studentId} />
                <input name='enrollmentId' type='hidden' value={student.enrollmentId} />
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
                  <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={student.courseId} name='courseId' required>
                    <option value=''>請選擇課程</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
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
                {student.enrollmentId ? (
                  <form action={deleteStudent}>
                    <input name='studentId' type='hidden' value={student.studentId} />
                    <input name='enrollmentId' type='hidden' value={student.enrollmentId} />
                    <button className='rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-600' type='submit'>
                      刪除學員
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
