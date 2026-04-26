import { supabaseAdmin } from './supabase-admin';
import { getGlobalRecentQuizAttempts, getJaeasyContentSummary, getMemberMetricsMap } from './jaeasy-data';

export type JaeasyAdminMemberRow = {
  studentId: string;
  userId: string;
  fullName: string;
  email: string;
  source: string;
  registeredAt: string;
  enrollmentId: string;
  courseId: string;
  courseName: string;
  lessonCount: number;
  remainingLessons: number;
  trackedVocabulary: number;
  dueReviews: number;
  upcomingReviews: number;
  masteredVocabulary: number;
  totalAttempts: number;
  accuracy: number;
  lastAnsweredAt: string | null;
};

type AuthUserSummary = {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: {
    full_name?: string;
  } | null;
};

export async function listAllAuthUsers() {
  const users: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`讀取 Auth 使用者失敗：${error.message}`);
    }

    const pageUsers = (data.users ?? []).map((user) => ({
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      user_metadata:
        user.user_metadata && typeof user.user_metadata === 'object'
          ? { full_name: typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : undefined }
          : null,
    }));

    users.push(...pageUsers);

    if (pageUsers.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function findAuthUserByEmail(email: string) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const users = await listAllAuthUsers();
  return users.find((user) => String(user.email ?? '').trim().toLowerCase() === normalizedEmail) ?? null;
}

export async function getJaeasyAdminOverview() {
  const [studentsResult, contentSummary, recentAttempts] = await Promise.all([
    supabaseAdmin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'jaeasy'),
    getJaeasyContentSummary(),
    getGlobalRecentQuizAttempts(8),
  ]);

  if (studentsResult.error) {
    throw new Error(`讀取 Jaeasy 學員數失敗：${studentsResult.error.message}`);
  }

  return {
    registeredMemberCount: studentsResult.count ?? 0,
    contentSummary,
    recentAttempts,
  };
}

export async function getJaeasyAdminMembers(): Promise<JaeasyAdminMemberRow[]> {
  const [authUsers, profilesResult, studentsResult] = await Promise.all([
    listAllAuthUsers(),
    supabaseAdmin.from('profiles').select('id,full_name,role'),
    supabaseAdmin
      .from('students')
      .select(
        'id,name,email,source,created_at,student_course_enrollments(id,course_id,lesson_count,remaining_lessons,status,courses(title))',
      )
      .eq('source', 'jaeasy')
      .order('created_at', { ascending: false }),
  ]);

  if (profilesResult.error) {
    throw new Error(`讀取 profiles 失敗：${profilesResult.error.message}`);
  }

  if (studentsResult.error) {
    throw new Error(`讀取 Jaeasy 學員失敗：${studentsResult.error.message}`);
  }

  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item]));
  const authUserMap = new Map(
    authUsers
      .filter((user) => typeof user.email === 'string' && user.email)
      .map((user) => [String(user.email).toLowerCase(), user]),
  );

  const userIds = (studentsResult.data ?? [])
    .map((student) => authUserMap.get(student.email.toLowerCase())?.id)
    .filter((value): value is string => Boolean(value));
  const metricsMap = await getMemberMetricsMap(userIds);

  return (studentsResult.data ?? []).map((student) => {
    const authUser = authUserMap.get(student.email.toLowerCase());
    const userId = authUser?.id ?? '';
    const profile = userId ? profileMap.get(userId) : null;
    const metrics = userId
      ? metricsMap.get(userId)
      : {
          trackedVocabulary: 0,
          dueReviews: 0,
          upcomingReviews: 0,
          masteredVocabulary: 0,
          totalAttempts: 0,
          accuracy: 0,
          correctAttempts: 0,
          lastAnsweredAt: null,
        };

    return {
      studentId: student.id,
      userId,
      fullName:
        profile?.full_name ||
        (typeof authUser?.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : '') ||
        student.name,
      email: student.email,
      source: student.source,
      registeredAt: authUser?.created_at || student.created_at,
      enrollmentId: student.student_course_enrollments?.[0]?.id ?? '',
      courseId: student.student_course_enrollments?.[0]?.course_id ?? '',
      courseName: (() => {
        const enrollment = student.student_course_enrollments?.[0];
        if (!enrollment) return '';
        const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
        return course?.title ?? '';
      })(),
      lessonCount: student.student_course_enrollments?.[0]?.lesson_count ?? 0,
      remainingLessons: student.student_course_enrollments?.[0]?.remaining_lessons ?? 0,
      trackedVocabulary: metrics?.trackedVocabulary ?? 0,
      dueReviews: metrics?.dueReviews ?? 0,
      upcomingReviews: metrics?.upcomingReviews ?? 0,
      masteredVocabulary: metrics?.masteredVocabulary ?? 0,
      totalAttempts: metrics?.totalAttempts ?? 0,
      accuracy: metrics?.accuracy ?? 0,
      lastAnsweredAt: metrics?.lastAnsweredAt ?? null,
    };
  });
}
