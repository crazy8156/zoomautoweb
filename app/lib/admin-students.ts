import { normalizeEmail } from './email';
import { getJaeasyAdminMembers, type JaeasyAdminMemberRow } from './jaeasy-admin';
import { supabaseAdmin } from './supabase-admin';

type StudentEnrollmentRow = {
  id: string;
  course_id: string;
  lesson_count: number;
  remaining_lessons: number;
  status: string;
  courses: { title: string } | { title: string }[] | null;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  source: string;
  created_at: string;
  updated_at: string;
  student_course_enrollments: StudentEnrollmentRow[] | null;
};

type ZoomRegistrantRow = {
  student_id: string | null;
  email: string;
  zoom_meeting_id: string;
  created_at: string;
};

type ZoomInviteeRow = {
  email: string;
  zoom_meeting_id: string;
  created_at: string;
};

type BookingRow = {
  student_id: string;
};

type CourseSessionRow = {
  id: string;
  course_id: string;
  start_time: string;
  zoom_meeting_id: number | null;
  zoom_join_url: string | null;
};

export type UnifiedStudentRow = {
  studentId: string;
  enrollmentId: string;
  name: string;
  email: string;
  courseId: string;
  courseName: string;
  lessonCount: number;
  remainingLessons: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  isJaeasyMember: boolean;
  userId: string;
  registeredAt: string | null;
  trackedVocabulary: number;
  dueReviews: number;
  upcomingReviews: number;
  masteredVocabulary: number;
  totalAttempts: number;
  accuracy: number;
  lastAnsweredAt: string | null;
  bookingCount: number;
  zoomBindingCount: number;
  latestZoomBoundAt: string | null;
  nextSessionId: string;
  nextSessionStartAt: string | null;
  nextSessionMeetingId: string;
  nextSessionJoinUrl: string | null;
};

export type UnifiedStudentFilters = {
  keyword?: string;
  memberType?: string;
  zoomStatus?: string;
  course?: string;
};

function firstItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toStudentBindingSummary(
  registrants: ZoomRegistrantRow[],
  invitees: ZoomInviteeRow[],
  students: StudentRow[],
) {
  const summaryByStudentId = new Map<string, { meetingIds: Set<string>; latestAt: string | null }>();
  const studentIdsByEmail = new Map(
    students
      .filter((student) => student.id && student.email)
      .map((student) => [normalizeEmail(student.email), student.id]),
  );

  const updateSummary = (studentId: string, meetingId: string, createdAt: string | null) => {
    const current = summaryByStudentId.get(studentId) ?? {
      meetingIds: new Set<string>(),
      latestAt: null,
    };
    current.meetingIds.add(meetingId);

    if (createdAt && (!current.latestAt || new Date(createdAt).getTime() > new Date(current.latestAt).getTime())) {
      current.latestAt = createdAt;
    }

    summaryByStudentId.set(studentId, current);
  };

  for (const registrant of registrants) {
    const studentId = registrant.student_id ?? studentIdsByEmail.get(normalizeEmail(registrant.email));
    if (!studentId) continue;
    updateSummary(studentId, String(registrant.zoom_meeting_id), registrant.created_at);
  }

  for (const invitee of invitees) {
    const studentId = studentIdsByEmail.get(normalizeEmail(invitee.email));
    if (!studentId) continue;
    updateSummary(studentId, String(invitee.zoom_meeting_id), invitee.created_at);
  }

  return new Map(
    Array.from(summaryByStudentId.entries()).map(([studentId, summary]) => [
      studentId,
      {
        count: summary.meetingIds.size,
        latestAt: summary.latestAt,
      },
    ]),
  );
}

function buildStudentSearchIndex(student: UnifiedStudentRow) {
  return [student.name, student.email, student.courseName, student.source].join(' ').toLowerCase();
}

export function formatAdminDateTime(value: string | null | undefined) {
  if (!value) return '未設定';

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

export function filterUnifiedStudents(students: UnifiedStudentRow[], filters: UnifiedStudentFilters) {
  const keyword = String(filters.keyword ?? '')
    .trim()
    .toLowerCase();
  const memberType = String(filters.memberType ?? 'all');
  const zoomStatus = String(filters.zoomStatus ?? 'all');
  const course = String(filters.course ?? 'all');

  return students.filter((student) => {
    if (keyword && !buildStudentSearchIndex(student).includes(keyword)) {
      return false;
    }

    if (memberType === 'course' && !student.courseName) {
      return false;
    }
    if (memberType === 'jaeasy' && !student.isJaeasyMember) {
      return false;
    }
    if (memberType === 'both' && !(student.isJaeasyMember && student.courseName)) {
      return false;
    }
    if (memberType === 'plain' && (student.isJaeasyMember || student.courseName)) {
      return false;
    }

    if (zoomStatus === 'bound' && student.zoomBindingCount === 0) {
      return false;
    }
    if (zoomStatus === 'unbound' && student.zoomBindingCount > 0) {
      return false;
    }

    if (course !== 'all' && student.courseName !== course) {
      return false;
    }

    return true;
  });
}

export function getStudentCourseOptions(students: UnifiedStudentRow[]) {
  return Array.from(new Set(students.map((student) => student.courseName).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-Hant'),
  );
}

export async function getUnifiedStudentRows(): Promise<UnifiedStudentRow[]> {
  const [{ data: studentsData, error: studentsError }, jaeasyMembers, registrantsResult, inviteesResult, bookingRowsResult] =
    await Promise.all([
      supabaseAdmin
        .from('students')
        .select(
          'id,name,email,source,created_at,updated_at,student_course_enrollments(id,course_id,lesson_count,remaining_lessons,status,courses(title))',
        )
        .order('updated_at', { ascending: false }),
      getJaeasyAdminMembers(),
      supabaseAdmin.from('zoom_meeting_registrants').select('student_id,email,zoom_meeting_id,created_at'),
      supabaseAdmin.from('zoom_meeting_invitees').select('email,zoom_meeting_id,created_at'),
      supabaseAdmin.from('bookings').select('student_id'),
    ]);

  if (studentsError) {
    throw new Error(`讀取學員資料失敗：${studentsError.message}`);
  }
  if (registrantsResult.error) {
    throw new Error(`讀取 Zoom 註冊資料失敗：${registrantsResult.error.message}`);
  }
  if (inviteesResult.error) {
    throw new Error(`讀取 Zoom 受邀者資料失敗：${inviteesResult.error.message}`);
  }
  if (bookingRowsResult.error) {
    throw new Error(`讀取預約資料失敗：${bookingRowsResult.error.message}`);
  }

  const students = (studentsData ?? []) as StudentRow[];
  const courseIds = Array.from(
    new Set(
      students.flatMap((student) => (student.student_course_enrollments ?? []).map((enrollment) => enrollment.course_id).filter(Boolean)),
    ),
  );

  const futureSessionRowsResult =
    courseIds.length > 0
      ? await supabaseAdmin
          .from('course_sessions')
          .select('id,course_id,start_time,zoom_meeting_id,zoom_join_url')
          .in('course_id', courseIds)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
      : { data: [] as CourseSessionRow[], error: null };

  if (futureSessionRowsResult.error) {
    throw new Error(`讀取未來課程場次失敗：${futureSessionRowsResult.error.message}`);
  }

  const nextSessionByCourseId = new Map<string, CourseSessionRow>();
  for (const session of (futureSessionRowsResult.data ?? []) as CourseSessionRow[]) {
    if (!session.course_id) continue;
    if (!nextSessionByCourseId.has(session.course_id)) {
      nextSessionByCourseId.set(session.course_id, session);
    }
  }

  const jaeasyMemberMap = new Map(jaeasyMembers.map((member) => [member.studentId, member]));
  const zoomBindingMap = toStudentBindingSummary(
    (registrantsResult.data ?? []) as ZoomRegistrantRow[],
    (inviteesResult.data ?? []) as ZoomInviteeRow[],
    students,
  );

  const bookingCountMap = new Map<string, number>();
  for (const row of (bookingRowsResult.data ?? []) as BookingRow[]) {
    bookingCountMap.set(row.student_id, (bookingCountMap.get(row.student_id) ?? 0) + 1);
  }

  return students.flatMap((student) => {
    const jaeasyMember = jaeasyMemberMap.get(student.id);
    const zoomBinding = zoomBindingMap.get(student.id) ?? { count: 0, latestAt: null };
    const bookingCount = bookingCountMap.get(student.id) ?? 0;
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
          remainingLessons: 0,
          source: student.source,
          createdAt: student.created_at,
          updatedAt: student.updated_at,
          isJaeasyMember: Boolean(jaeasyMember),
          userId: jaeasyMember?.userId ?? '',
          registeredAt: jaeasyMember?.registeredAt ?? student.created_at,
          trackedVocabulary: jaeasyMember?.trackedVocabulary ?? 0,
          dueReviews: jaeasyMember?.dueReviews ?? 0,
          upcomingReviews: jaeasyMember?.upcomingReviews ?? 0,
          masteredVocabulary: jaeasyMember?.masteredVocabulary ?? 0,
          totalAttempts: jaeasyMember?.totalAttempts ?? 0,
          accuracy: jaeasyMember?.accuracy ?? 0,
          lastAnsweredAt: jaeasyMember?.lastAnsweredAt ?? null,
          bookingCount,
          zoomBindingCount: zoomBinding.count,
          latestZoomBoundAt: zoomBinding.latestAt,
          nextSessionId: '',
          nextSessionStartAt: null,
          nextSessionMeetingId: '',
          nextSessionJoinUrl: null,
        } satisfies UnifiedStudentRow,
      ];
    }

    return enrollments.map((enrollment) => {
      const nextSession = nextSessionByCourseId.get(enrollment.course_id);

      return {
        studentId: student.id,
        enrollmentId: enrollment.id,
        name: student.name,
        email: student.email,
        courseId: enrollment.course_id,
        courseName: firstItem(enrollment.courses)?.title ?? '',
        lessonCount: enrollment.lesson_count,
        remainingLessons: enrollment.remaining_lessons,
        source: student.source,
        createdAt: student.created_at,
        updatedAt: student.updated_at,
        isJaeasyMember: Boolean(jaeasyMember),
        userId: jaeasyMember?.userId ?? '',
        registeredAt: jaeasyMember?.registeredAt ?? student.created_at,
        trackedVocabulary: jaeasyMember?.trackedVocabulary ?? 0,
        dueReviews: jaeasyMember?.dueReviews ?? 0,
        upcomingReviews: jaeasyMember?.upcomingReviews ?? 0,
        masteredVocabulary: jaeasyMember?.masteredVocabulary ?? 0,
        totalAttempts: jaeasyMember?.totalAttempts ?? 0,
        accuracy: jaeasyMember?.accuracy ?? 0,
        lastAnsweredAt: jaeasyMember?.lastAnsweredAt ?? null,
        bookingCount,
        zoomBindingCount: zoomBinding.count,
        latestZoomBoundAt: zoomBinding.latestAt,
        nextSessionId: nextSession?.id ?? '',
        nextSessionStartAt: nextSession?.start_time ?? null,
        nextSessionMeetingId: String(nextSession?.zoom_meeting_id ?? ''),
        nextSessionJoinUrl: nextSession?.zoom_join_url ?? null,
      } satisfies UnifiedStudentRow;
    });
  });
}

export function toStudentCsv(students: UnifiedStudentRow[]) {
  const rows = [studentExportHeaders, ...students.map((student) => [
      student.name,
      student.email,
      student.courseName,
      String(student.lessonCount),
      String(student.remainingLessons),
      student.source,
      student.isJaeasyMember && student.courseName ? '課程 + 自學' : student.isJaeasyMember ? '自學會員' : student.courseName ? '課程學員' : '一般學員',
      String(student.bookingCount),
      String(student.zoomBindingCount),
      formatAdminDateTime(student.nextSessionStartAt),
      formatAdminDateTime(student.latestZoomBoundAt),
      String(student.trackedVocabulary),
      String(student.dueReviews),
      String(student.totalAttempts),
      `${student.accuracy}%`,
    ])];

  return rows
    .map((columns) =>
      columns
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
}

const studentExportHeaders = [
  '姓名',
  'Email',
  '課程名稱',
  '總堂數',
  '剩餘堂數',
  '來源',
  '會員類型',
  '預約數',
  'Zoom 綁定數',
  '下一堂課',
  '最近 Zoom 綁定',
  '追蹤單字',
  '待複習',
  '作答數',
  '正確率',
];

export function getStudentExportRows(students: UnifiedStudentRow[]) {
  return students.map((student) => [
      student.name,
      student.email,
      student.courseName,
      String(student.lessonCount),
      String(student.remainingLessons),
      student.source,
      student.isJaeasyMember && student.courseName ? '課程 + 自學' : student.isJaeasyMember ? '自學會員' : student.courseName ? '課程學員' : '一般學員',
      String(student.bookingCount),
      String(student.zoomBindingCount),
      formatAdminDateTime(student.nextSessionStartAt),
      formatAdminDateTime(student.latestZoomBoundAt),
      String(student.trackedVocabulary),
      String(student.dueReviews),
      String(student.totalAttempts),
      `${student.accuracy}%`,
    ]);
}

export function getStudentExportHeaders() {
  return [...studentExportHeaders];
}
