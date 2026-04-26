export type Course = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  max_students: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
};

export type CourseSession = {
  id: string;
  course_id: string;
  start_time: string;
  zoom_join_url: string | null;
  zoom_meeting_id?: string | number | null;
  courses?: Pick<Course, 'title' | 'duration_minutes' | 'price' | 'max_students'> | Pick<Course, 'title' | 'duration_minutes' | 'price' | 'max_students'>[] | null;
};

export type Booking = {
  id: string;
  status: string;
  booked_at: string;
  student_id: string;
  session_id: string;
};

export function firstItem<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '未設定';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(date);
}

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-TW', {
    currency: 'TWD',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value ?? 0);
}

export function formatBookingStatus(status: string | null | undefined) {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'booked':
      return '已預約';
    case 'attended':
      return '已出席';
    case 'absent':
      return '缺席';
    case 'late':
      return '遲到';
    case 'left_early':
      return '早退';
    case 'cancelled':
      return '已取消';
    default:
      return status?.trim() || '未設定';
  }
}
