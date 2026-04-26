import type { ReactNode } from 'react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ConfirmSubmitButton } from '../../components/confirm-submit-button';
import {
  filterUnifiedStudents,
  formatAdminDateTime,
  getStudentCourseOptions,
  getUnifiedStudentRows,
  type UnifiedStudentRow,
} from '../../lib/admin-students';
import { requireAdminSession } from '../../lib/admin';
import { findOrCreateCourseByTitle } from '../../lib/course-admin';
import { normalizeEmail } from '../../lib/email';
import { findAuthUserByEmail } from '../../lib/jaeasy-admin';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { addZoomMeetingRegistrant } from '../../lib/zoom';

type SearchParams = {
  q?: string;
  memberType?: string;
  zoomStatus?: string;
  course?: string;
};

function normalizeLessonCount(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeRemainingLessons(value: FormDataEntryValue | null, lessonCount: number) {
  const parsed = Number(value ?? lessonCount);
  if (!Number.isFinite(parsed) || parsed < 0) return lessonCount;
  return parsed > lessonCount ? lessonCount : parsed;
}

function normalizeFilter(value: string | undefined, allowed: string[], fallback: string) {
  return allowed.includes(value ?? '') ? String(value) : fallback;
}

function buildMemberLabel(student: UnifiedStudentRow) {
  if (student.isJaeasyMember && student.courseName) return '課程 + 自學';
  if (student.isJaeasyMember) return '自學會員';
  if (student.courseName) return '課程學員';
  return '一般學員';
}


function buildRegistrantNameParts(fullName: string, email: string) {
  const normalizedFullName = fullName.trim();
  if (!normalizedFullName) {
    return {
      firstName: email.split('@')[0] || 'Student',
      lastName: '',
    };
  }

  const parts = normalizedFullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function buildSessionsDateHref(value: string | null) {
  if (!value) return '/admin/sessions';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '/admin/sessions';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `/admin/sessions?date=${year}-${month}-${day}&month=${year}-${month}`;
}

function buildExportHref(params: SearchParams) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.memberType) search.set('memberType', params.memberType);
  if (params.zoomStatus) search.set('zoomStatus', params.zoomStatus);
  if (params.course) search.set('course', params.course);

  const query = search.toString();
  return query ? `/admin/students/export?${query}` : '/admin/students/export';
}

async function syncJaeasyAccount({
  previousEmail,
  nextEmail,
  fullName,
}: {
  previousEmail: string;
  nextEmail: string;
  fullName: string;
}) {
  const authUser = await findAuthUserByEmail(previousEmail);
  if (!authUser?.id) return;

  const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    email: nextEmail,
    user_metadata: {
      ...(authUser.user_metadata ?? {}),
      full_name: fullName,
    },
  });

  if (updateAuthError) {
    throw new Error(`更新自學會員登入帳號失敗：${updateAuthError.message}`);
  }

  const { error: updateProfileError } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', authUser.id);

  if (updateProfileError) {
    throw new Error(`更新自學會員 profile 失敗：${updateProfileError.message}`);
  }
}

function revalidateStudentPaths() {
  revalidatePath('/admin');
  revalidatePath('/admin/students');
  revalidatePath('/admin/jaeasy');
  revalidatePath('/admin/jaeasy/members');
  revalidatePath('/admin/sessions');
  revalidatePath('/student');
  revalidatePath('/student/course-center');
  revalidatePath('/my-bookings');
}

async function createStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const name = String(formData.get('name') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const courseName = String(formData.get('courseName') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const lessonCount = normalizeLessonCount(formData.get('lessonCount'));
  const remainingLessons = normalizeRemainingLessons(formData.get('remainingLessons'), lessonCount);

  if (!name || !email || !source) {
    throw new Error('請完整填寫姓名、Email 與來源。');
  }

  const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingStudentError) {
    throw new Error(`查詢學生失敗：${existingStudentError.message}`);
  }

  let studentId = existingStudent?.id ?? '';

  if (!studentId) {
    const { data: createdStudent, error: createStudentError } = await supabaseAdmin
      .from('students')
      .insert({ name, email, source })
      .select('id')
      .single();

    if (createStudentError) {
      throw new Error(`新增學生失敗：${createStudentError.message}`);
    }

    studentId = createdStudent.id;
  } else {
    const { error: updateStudentError } = await supabaseAdmin
      .from('students')
      .update({ name, email, source })
      .eq('id', studentId);

    if (updateStudentError) {
      throw new Error(`更新學生失敗：${updateStudentError.message}`);
    }
  }

  if (courseName) {
    const { id: courseId } = await findOrCreateCourseByTitle(courseName);

    const { error: upsertEnrollmentError } = await supabaseAdmin
      .from('student_course_enrollments')
      .upsert(
        {
          student_id: studentId,
          course_id: courseId,
          lesson_count: lessonCount,
          remaining_lessons: remainingLessons,
          status: 'active',
        },
        { onConflict: 'student_id,course_id' },
      );

    if (upsertEnrollmentError) {
      throw new Error(`新增課程堂數失敗：${upsertEnrollmentError.message}`);
    }
  }

  revalidateStudentPaths();
}

async function updateStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const studentId = String(formData.get('studentId') ?? '').trim();
  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const courseName = String(formData.get('courseName') ?? '').trim();
  const source = String(formData.get('source') ?? '').trim();
  const lessonCount = normalizeLessonCount(formData.get('lessonCount'));
  const remainingLessons = normalizeRemainingLessons(formData.get('remainingLessons'), lessonCount);

  if (!studentId || !name || !email || !source) {
    throw new Error('請完整填寫學生資料。');
  }

  const { data: currentStudent, error: currentStudentError } = await supabaseAdmin
    .from('students')
    .select('email')
    .eq('id', studentId)
    .single();

  if (currentStudentError) {
    throw new Error(`讀取學生資料失敗：${currentStudentError.message}`);
  }

  const { error: updateStudentError } = await supabaseAdmin
    .from('students')
    .update({ name, email, source })
    .eq('id', studentId);

  if (updateStudentError) {
    throw new Error(`更新學生失敗：${updateStudentError.message}`);
  }

  if (source === 'jaeasy' || normalizeEmail(currentStudent.email) !== email) {
    await syncJaeasyAccount({
      previousEmail: normalizeEmail(currentStudent.email),
      nextEmail: email,
      fullName: name,
    });
  }

  if (courseName) {
    const { id: courseId } = await findOrCreateCourseByTitle(courseName);

    if (enrollmentId) {
      const { error: updateEnrollmentError } = await supabaseAdmin
        .from('student_course_enrollments')
        .update({
          course_id: courseId,
          lesson_count: lessonCount,
          remaining_lessons: remainingLessons,
        })
        .eq('id', enrollmentId);

      if (updateEnrollmentError) {
        throw new Error(`更新課程堂數失敗：${updateEnrollmentError.message}`);
      }
    } else {
      const { error: insertEnrollmentError } = await supabaseAdmin.from('student_course_enrollments').insert({
        student_id: studentId,
        course_id: courseId,
        lesson_count: lessonCount,
        remaining_lessons: remainingLessons,
        status: 'active',
      });

      if (insertEnrollmentError) {
        throw new Error(`新增課程堂數失敗：${insertEnrollmentError.message}`);
      }
    }
  } else if (enrollmentId) {
    throw new Error('若要保留這筆課程資料，請填寫課程名稱；若要移除課程，請用刪除功能處理。');
  }

  revalidateStudentPaths();
}

async function deductLesson(formData: FormData) {
  'use server';

  await requireAdminSession();

  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();
  if (!enrollmentId) {
    throw new Error('找不到要扣堂的課程資料。');
  }

  const { data: enrollment, error: enrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .select('remaining_lessons')
    .eq('id', enrollmentId)
    .single();

  if (enrollmentError) {
    throw new Error(`讀取堂數失敗：${enrollmentError.message}`);
  }

  const nextRemainingLessons = Math.max(Number(enrollment.remaining_lessons ?? 0) - 1, 0);
  const { error: updateEnrollmentError } = await supabaseAdmin
    .from('student_course_enrollments')
    .update({ remaining_lessons: nextRemainingLessons })
    .eq('id', enrollmentId);

  if (updateEnrollmentError) {
    throw new Error(`扣堂失敗：${updateEnrollmentError.message}`);
  }

  revalidateStudentPaths();
}

async function backfillZoomBinding(formData: FormData) {
  'use server';

  await requireAdminSession();

  const studentId = String(formData.get('studentId') ?? '').trim();
  const courseId = String(formData.get('courseId') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const name = String(formData.get('name') ?? '').trim();

  if (!studentId || !courseId || !email) {
    throw new Error('補綁 Zoom 前，請先確認學生已綁定課程與 Email。');
  }

  const { data: sessionRows, error: sessionRowsError } = await supabaseAdmin
    .from('course_sessions')
    .select('zoom_meeting_id,start_time')
    .eq('course_id', courseId)
    .gte('start_time', new Date().toISOString())
    .not('zoom_meeting_id', 'is', null)
    .order('start_time', { ascending: true })
    .limit(200);

  if (sessionRowsError) {
    throw new Error(`讀取未來 Zoom 場次失敗：${sessionRowsError.message}`);
  }

  const meetingIds = Array.from(
    new Set(
      (sessionRows ?? [])
        .map((row) => Number(row.zoom_meeting_id))
        .filter((meetingId) => Number.isFinite(meetingId) && meetingId > 0),
    ),
  );

  if (meetingIds.length === 0) {
    throw new Error('這門課目前還沒有可補綁的未來 Zoom 會議。');
  }

  const inviteeRows = meetingIds.map((meetingId) => ({
    zoom_meeting_id: String(meetingId),
    email,
  }));

  const { error: inviteesError } = await supabaseAdmin
    .from('zoom_meeting_invitees')
    .upsert(inviteeRows, { onConflict: 'zoom_meeting_id,email' });

  if (inviteesError) {
    throw new Error(`儲存 Zoom 受邀者失敗：${inviteesError.message}`);
  }

  const { firstName, lastName } = buildRegistrantNameParts(name, email);
  const registrantRows: Array<{
    zoom_meeting_id: string;
    email: string;
    student_id: string;
    first_name: string;
    last_name: string | null;
    zoom_registrant_id: string | null;
    join_url: string | null;
    status: string;
    updated_at: string;
  }> = [];

  for (const meetingId of meetingIds) {
    try {
      const registrant = await addZoomMeetingRegistrant({
        meetingId,
        email,
        firstName,
        lastName: lastName || undefined,
      });

      registrantRows.push({
        zoom_meeting_id: String(meetingId),
        email,
        student_id: studentId,
        first_name: firstName,
        last_name: lastName || null,
        zoom_registrant_id: registrant.registrant_id ?? registrant.id ?? null,
        join_url: registrant.join_url ?? null,
        status: registrant.status ?? 'approved',
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const ignorableError =
        message.includes('Registration has not been enabled') ||
        message.includes('Registrant already exists') ||
        message.includes('already registered') ||
        message.includes('does not require registration');

      if (!ignorableError) {
        throw error;
      }
    }
  }

  if (registrantRows.length > 0) {
    const { error: registrantsError } = await supabaseAdmin
      .from('zoom_meeting_registrants')
      .upsert(registrantRows, { onConflict: 'zoom_meeting_id,email' });

    if (registrantsError) {
      throw new Error(`儲存 Zoom 註冊資料失敗：${registrantsError.message}`);
    }
  }

  revalidateStudentPaths();
}

async function deleteStudent(formData: FormData) {
  'use server';

  await requireAdminSession();

  const studentId = String(formData.get('studentId') ?? '').trim();
  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();

  if (!studentId) {
    throw new Error('找不到要刪除的學生資料。');
  }

  if (enrollmentId) {
    const { error: deleteEnrollmentError } = await supabaseAdmin
      .from('student_course_enrollments')
      .delete()
      .eq('id', enrollmentId);

    if (deleteEnrollmentError) {
      throw new Error(`刪除課程資料失敗：${deleteEnrollmentError.message}`);
    }
  }

  const { count, error: remainingError } = await supabaseAdmin
    .from('student_course_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);

  if (remainingError) {
    throw new Error(`查詢剩餘課程資料失敗：${remainingError.message}`);
  }

  if ((count ?? 0) === 0) {
    const { data: currentStudent, error: currentStudentError } = await supabaseAdmin
      .from('students')
      .select('email,source')
      .eq('id', studentId)
      .single();

    if (currentStudentError) {
      throw new Error(`讀取學生資料失敗：${currentStudentError.message}`);
    }

    const authUser = await findAuthUserByEmail(currentStudent.email);

    const { error: deleteStudentError } = await supabaseAdmin.from('students').delete().eq('id', studentId);
    if (deleteStudentError) {
      throw new Error(`刪除學生失敗：${deleteStudentError.message}`);
    }

    if (authUser?.id && currentStudent.source === 'jaeasy') {
      const { error: deleteSrsError } = await supabaseAdmin.from('jaeasy_user_vocab_srs').delete().eq('user_id', authUser.id);
      if (deleteSrsError) {
        throw new Error(`刪除自學複習紀錄失敗：${deleteSrsError.message}`);
      }

      const { error: deleteAttemptsError } = await supabaseAdmin.from('jaeasy_quiz_attempts').delete().eq('user_id', authUser.id);
      if (deleteAttemptsError) {
        throw new Error(`刪除自學作答紀錄失敗：${deleteAttemptsError.message}`);
      }

      const { error: deleteProfileError } = await supabaseAdmin.from('profiles').delete().eq('id', authUser.id);
      if (deleteProfileError) {
        throw new Error(`刪除自學會員 profile 失敗：${deleteProfileError.message}`);
      }

      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (deleteAuthError) {
        throw new Error(`刪除自學會員登入帳號失敗：${deleteAuthError.message}`);
      }
    }
  }

  revalidateStudentPaths();
}

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();

  const resolvedSearchParams = await searchParams;
  const memberType = normalizeFilter(resolvedSearchParams.memberType, ['all', 'course', 'jaeasy', 'both', 'plain'], 'all');
  const zoomStatus = normalizeFilter(resolvedSearchParams.zoomStatus, ['all', 'bound', 'unbound'], 'all');
  const course = String(resolvedSearchParams.course ?? 'all');

  const students = await getUnifiedStudentRows();
  const courseOptions = getStudentCourseOptions(students);
  const filteredStudents = filterUnifiedStudents(students, {
    keyword: resolvedSearchParams.q ?? '',
    memberType,
    zoomStatus,
    course,
  });

  const totalStudentCount = new Set(students.map((student) => student.studentId)).size;
  const jaeasyCount = new Set(students.filter((student) => student.isJaeasyMember).map((student) => student.studentId)).size;
  const courseStudentCount = new Set(students.filter((student) => student.courseName).map((student) => student.studentId)).size;
  const zoomBoundCount = new Set(students.filter((student) => student.zoomBindingCount > 0).map((student) => student.studentId)).size;
  const exportHref = buildExportHref({
    q: resolvedSearchParams.q,
    memberType,
    zoomStatus,
    course: course === 'all' ? undefined : course,
  });

  return (
    <main className='admin-shell'>
      <section className='admin-hero'>
        <header className='admin-topbar'>
          <div>
            <p className='admin-kicker'>學生主名單</p>
            <h1 className='admin-title'>{'學生主名單'}</h1>
            <p className='admin-subtitle'>{'同一份名單整合課程學員、自學會員、課程堂數、Zoom 綁定和學習數據。你之後只要維護這一頁，就能把學生資料、堂數和上課對應一次看清楚。'}</p>
          </div>
          <div className='admin-actions'>
            <Link href='/admin/course-center' className='admin-link-pill'>
              {'回課程中心'}
            </Link>
            <Link href='/admin/jaeasy' className='admin-link-pill'>
              {'回自學中心'}
            </Link>
          </div>
        </header>

        <div className='admin-metric-grid'>
          <MetricCard label={'學生總數'} value={`${totalStudentCount}`} />
          <MetricCard label={'自學會員'} value={`${jaeasyCount}`} />
          <MetricCard label={'有課程堂數'} value={`${courseStudentCount}`} />
          <MetricCard label={'已綁定 Zoom'} value={`${zoomBoundCount}`} />
        </div>
      </section>

      <section className='admin-panel mt-6'>
        <div className='admin-topbar'>
          <div>
            <p className='admin-kicker'>搜尋與篩選</p>
            <h2 className='mt-3 text-2xl font-black tracking-tight'>{'搜尋與篩選'}</h2>
            <p className='admin-subtitle'>{`目前顯示 ${filteredStudents.length} 筆資料，可以依會員類型、課程和 Zoom 綁定狀態快速整理名單。`} </p>
          </div>
          <Link className='admin-link-pill' href={exportHref}>
            {'匯出 Excel'}
          </Link>
        </div>

        <form className='mt-6 grid gap-4 md:grid-cols-5'>
          <label className='text-sm font-semibold text-slate-700'>
            {'關鍵字搜尋'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm outline-none focus:border-sky-300' defaultValue={resolvedSearchParams.q ?? ''} name='q' placeholder={'姓名、Email、課程、來源'} />
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'會員類型'}
            <select className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm outline-none focus:border-sky-300' defaultValue={memberType} name='memberType'>
              <option value='all'>{'全部'}</option>
              <option value='course'>{'只有課程學員'}</option>
              <option value='jaeasy'>{'只有自學會員'}</option>
              <option value='both'>{'課程 + 自學'}</option>
              <option value='plain'>{'一般名單'}</option>
            </select>
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'Zoom 狀態'}
            <select className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm outline-none focus:border-sky-300' defaultValue={zoomStatus} name='zoomStatus'>
              <option value='all'>{'全部'}</option>
              <option value='bound'>{'已綁定 Zoom'}</option>
              <option value='unbound'>{'未綁定 Zoom'}</option>
            </select>
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'課程名稱'}
            <select className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm outline-none focus:border-sky-300' defaultValue={course} name='course'>
              <option value='all'>{'全部課程'}</option>
              {courseOptions.map((courseName) => (
                <option key={courseName} value={courseName}>
                  {courseName}
                </option>
              ))}
            </select>
          </label>
          <div className='flex items-end gap-3'>
            <button className='admin-primary-button' type='submit'>
              {'套用篩選'}
            </button>
            <Link className='admin-secondary-button' href='/admin/students'>
              {'清除'}
            </Link>
          </div>
        </form>
      </section>

      <section className='admin-panel mt-6'>
        <div>
            <p className='admin-kicker'>新增學生</p>
          <h2 className='mt-3 text-2xl font-black tracking-tight'>{'新增學生'}</h2>
          <p className='admin-subtitle'>{'建立新學生時，就可以一起補課程、堂數和來源，後面排 Zoom 課會比較順。'}</p>
        </div>
        <form action={createStudent} className='mt-6 grid gap-4 md:grid-cols-6'>
          <label className='text-sm font-semibold text-slate-700'>
            {'姓名'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm' name='name' required />
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'帳號 Email'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm' name='email' required type='email' />
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'課程名稱'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm' name='courseName' placeholder={'可先留空'} />
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'總堂數'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm' min='0' name='lessonCount' type='number' />
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'剩餘堂數'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm' min='0' name='remainingLessons' type='number' />
          </label>
          <label className='text-sm font-semibold text-slate-700'>
            {'來源'}
            <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 font-normal shadow-sm' name='source' placeholder={'介紹 / Line / 官網'} required />
          </label>
          <button className='admin-primary-button md:col-span-1' type='submit'>
            {'新增學生'}
          </button>
        </form>
      </section>

      <section className='mt-6 grid gap-5'>
        {filteredStudents.length === 0 ? (
          <div className='admin-panel border-dashed text-sm text-slate-600'>{'目前沒有符合條件的學生資料。'}</div>
        ) : (
          filteredStudents.map((student) => (
            <article key={`${student.studentId}-${student.enrollmentId || 'profile'}`} className='overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_48px_rgba(15,23,42,0.08)] backdrop-blur'>
              <div className='flex flex-wrap items-start justify-between gap-4'>
                <div>
                  <div className='flex flex-wrap items-center gap-2.5'>
                    <h2 className='text-2xl font-black tracking-tight text-slate-950'>{student.name}</h2>
                    <Badge tone='slate'>{buildMemberLabel(student)}</Badge>
                    {student.zoomBindingCount > 0 ? (
                      <Badge tone='violet'>{`已綁定 Zoom ${student.zoomBindingCount} 堂`}</Badge>
                    ) : (
                      <Badge tone='amber'>{'未綁定 Zoom'}</Badge>
                    )}
                  </div>
                  <p className='mt-2 text-base text-slate-600'>{student.email}</p>
                </div>
                <div className='rounded-2xl bg-slate-50/90 px-4 py-3 text-right text-sm text-slate-500'>
                  <p>{`註冊時間：${formatAdminDateTime(student.registeredAt ?? student.createdAt)}`}</p>
                  <p className='mt-1'>{`最後更新：${formatAdminDateTime(student.updatedAt)}`}</p>
                  {student.lastAnsweredAt ? <p className='mt-1'>{`最近作答：${formatAdminDateTime(student.lastAnsweredAt)}`}</p> : null}
                  {student.latestZoomBoundAt ? <p className='mt-1'>{`最近綁定 Zoom：${formatAdminDateTime(student.latestZoomBoundAt)}`}</p> : null}
                </div>
              </div>

              <form action={updateStudent} className='mt-5 grid gap-4 rounded-[1.4rem] bg-slate-50/70 p-5 md:grid-cols-7'>
                <input name='studentId' type='hidden' value={student.studentId} />
                <input name='enrollmentId' type='hidden' value={student.enrollmentId} />
                <label className='text-sm font-semibold text-slate-700'>
                  {'姓名'}
                  <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm' defaultValue={student.name} name='name' required />
                </label>
                <label className='text-sm font-semibold text-slate-700'>
                  {'帳號 Email'}
                  <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm' defaultValue={student.email} name='email' required type='email' />
                </label>
                <label className='text-sm font-semibold text-slate-700'>
                  {'課程名稱'}
                  <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm' defaultValue={student.courseName} name='courseName' placeholder={'可留空'} />
                </label>
                <label className='text-sm font-semibold text-slate-700'>
                  {'總堂數'}
                  <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm' defaultValue={student.lessonCount} min='0' name='lessonCount' type='number' />
                </label>
                <label className='text-sm font-semibold text-slate-700'>
                  {'剩餘堂數'}
                  <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm' defaultValue={student.remainingLessons} min='0' name='remainingLessons' type='number' />
                </label>
                <label className='text-sm font-semibold text-slate-700'>
                  {'來源'}
                  <input className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm' defaultValue={student.source} name='source' required />
                </label>
                <div className='flex items-end gap-3'>
                  <button className='admin-primary-button' type='submit'>
                    {'儲存修改'}
                  </button>
                </div>
              </form>

              <div className='mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_360px]'>
                <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-4'>
                  <StatBox label={'來源'} value={student.source} />
                  <StatBox label={'課程'} value={student.courseName || '未設定'} />
                  <StatBox label={'總堂數'} value={`${student.lessonCount}`} />
                  <StatBox label={'剩餘堂數'} value={`${student.remainingLessons}`} />
                  <StatBox label={'預約數'} value={`${student.bookingCount}`} />
                  <StatBox label={'追蹤單字'} value={`${student.trackedVocabulary}`} />
                  <StatBox label={'待複習'} value={`${student.dueReviews}`} />
                  <StatBox label={'作答數'} value={`${student.totalAttempts}`} />
                  <StatBox label={'正確率'} value={`${student.accuracy}%`} />
                </div>

                <div className='rounded-[1.4rem] border border-sky-200/70 bg-[linear-gradient(180deg,rgba(235,246,255,0.96),rgba(219,239,255,0.72))] p-5 text-sm text-slate-700'>
                  <p className='text-xs font-black uppercase tracking-[0.14em] text-sky-700'>Zoom</p>
                  <p className='mt-2 text-2xl font-black tracking-tight text-slate-950'>{'下一堂 Zoom 課'}</p>
                  <p className='mt-2'>{student.nextSessionStartAt ? formatAdminDateTime(student.nextSessionStartAt) : '尚未安排未來課程'}</p>
                  {student.courseName ? <p className='mt-1 text-slate-500'>{`課程：${student.courseName}`}</p> : null}
                  {student.nextSessionMeetingId ? <p className='mt-1 text-slate-500'>{`Meeting ID：${student.nextSessionMeetingId}`}</p> : null}
                  <div className='mt-3 flex flex-wrap gap-3'>
                    <Link className='rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-semibold text-sky-700' href={buildSessionsDateHref(student.nextSessionStartAt)}>
                      {'看 Zoom 日曆'}
                    </Link>
                    {student.nextSessionJoinUrl ? (
                      <a className='rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700' href={student.nextSessionJoinUrl} rel='noreferrer' target='_blank'>
                        {'打開會議'}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className='mt-5 flex flex-wrap items-start justify-end gap-3 border-t border-slate-200 pt-5'>
                {student.enrollmentId ? (
                  <form action={deductLesson}>
                    <input name='enrollmentId' type='hidden' value={student.enrollmentId} />
                    <ConfirmSubmitButton className='rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700' label={'扣 1 堂'} message={`確定要替 ${student.name} 扣 1 堂嗎？目前剩餘 ${student.remainingLessons} 堂。`} />
                  </form>
                ) : null}

                {student.courseId ? (
                  <form action={backfillZoomBinding}>
                    <input name='studentId' type='hidden' value={student.studentId} />
                    <input name='courseId' type='hidden' value={student.courseId} />
                    <input name='email' type='hidden' value={student.email} />
                    <input name='name' type='hidden' value={student.name} />
                    <button className='rounded-full border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-semibold text-violet-700' type='submit'>
                      {'一鍵補綁 Zoom'}
                    </button>
                  </form>
                ) : null}

                {student.isJaeasyMember ? (
                  <Link href='/admin/jaeasy' className='rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700'>
                    {'看自學後台'}
                  </Link>
                ) : null}

                <form action={deleteStudent}>
                  <input name='studentId' type='hidden' value={student.studentId} />
                  <input name='enrollmentId' type='hidden' value={student.enrollmentId} />
                  <ConfirmSubmitButton className='rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600' label={'刪除學員'} message={`確定要刪除 ${student.name} 的這筆學生資料嗎？如果這是最後一筆資料，系統也會一併清掉關聯帳號與紀錄。`} />
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='admin-metric-card'>
      <p className='admin-metric-label'>{label}</p>
      <p className='admin-metric-value'>{value}</p>
    </article>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-[1.2rem] border border-slate-200/80 bg-white/88 px-4 py-4 shadow-sm'>
      <p className='text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400'>{label}</p>
      <p className='mt-2 text-lg font-black tracking-tight text-slate-950'>{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: 'slate' | 'amber' | 'violet' }) {
  const className =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'violet'
        ? 'bg-violet-50 text-violet-700'
        : 'bg-slate-100 text-slate-700';

  return <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm ${className}`}>{children}</span>;
}
