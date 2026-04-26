import { supabaseAdmin } from './supabase-admin';

type ZoomRegistrantLinkRow = {
  zoom_meeting_id: string;
  join_url: string | null;
};

export async function getStudentZoomJoinUrlMap(
  studentId: string | null | undefined,
  meetingIds: Array<string | number | null | undefined>,
) {
  if (!studentId) {
    return new Map<string, string>();
  }

  const normalizedMeetingIds = Array.from(
    new Set(
      meetingIds
        .map((meetingId) => String(meetingId ?? '').trim())
        .filter(Boolean),
    ),
  );

  if (normalizedMeetingIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabaseAdmin
    .from('zoom_meeting_registrants')
    .select('zoom_meeting_id,join_url')
    .eq('student_id', studentId)
    .in('zoom_meeting_id', normalizedMeetingIds)
    .not('join_url', 'is', null);

  if (error) {
    throw new Error(`讀取學生 Zoom 專屬連結失敗：${error.message}`);
  }

  return new Map(
    ((data ?? []) as ZoomRegistrantLinkRow[])
      .filter((row) => row.zoom_meeting_id && row.join_url)
      .map((row) => [String(row.zoom_meeting_id), String(row.join_url)]),
  );
}
