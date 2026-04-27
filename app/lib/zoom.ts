type ZoomMeeting = {
  id: number;
  join_url: string;
  start_url?: string;
  start_time?: string;
  topic?: string;
  host_email?: string;
};

type CreateZoomMeetingInput = {
  topic: string;
  startTime: string;
  durationMinutes: number;
  agenda?: string;
  timezone?: string;
  password?: string;
  usePmi?: boolean;
  requireRegistration?: boolean;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  hostVideo?: boolean;
  participantVideo?: boolean;
  muteUponEntry?: boolean;
  autoRecording?: 'none' | 'local' | 'cloud';
  audio?: 'both' | 'telephony' | 'voip';
  isRecurring?: boolean;
  recurrence?: {
    type: 1 | 2 | 3;
    repeatInterval: number;
    weeklyDays?: string;
    endTimes?: number;
  };
};

type UpdateZoomMeetingInput = {
  meetingId: string | number;
  topic: string;
  startTime: string;
  durationMinutes: number;
  agenda?: string;
  timezone?: string;
  password?: string;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  hostVideo?: boolean;
  participantVideo?: boolean;
  muteUponEntry?: boolean;
  autoRecording?: 'none' | 'local' | 'cloud';
  audio?: 'both' | 'telephony' | 'voip';
};

type ListZoomMeetingsResult = {
  meetings: ZoomMeeting[];
};

type ZoomMeetingDetail = ZoomMeeting & {
  password?: string;
  occurrences?: Array<{
    occurrence_id?: string;
    start_time?: string;
    status?: string;
    duration?: number;
  }>;
};

type ZoomRegistrant = {
  id?: string;
  registrant_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  join_url?: string;
  status?: string;
};

type ZoomRegistrantListResult = {
  next_page_token?: string;
  registrants?: ZoomRegistrant[];
};

type AddZoomMeetingRegistrantInput = {
  meetingId: string | number;
  email: string;
  firstName: string;
  lastName?: string;
};

type CachedZoomToken = {
  value: string;
  expiresAt: number;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

const ZOOM_LIST_TTL_MS = 60 * 1000;
const ZOOM_DETAIL_TTL_MS = 60 * 1000;
const ZOOM_REGISTRANTS_TTL_MS = 60 * 1000;
const ZOOM_TOKEN_SAFETY_MS = 60 * 1000;

let cachedZoomToken: CachedZoomToken | null = null;
let zoomTokenPromise: Promise<string> | null = null;
let cachedMeetingList: CachedValue<ZoomMeeting[]> | null = null;
const meetingDetailCache = new Map<string, CachedValue<ZoomMeetingDetail | null>>();
const meetingRegistrantCache = new Map<string, CachedValue<ZoomRegistrant[]>>();

function toZoomStartTime(startTime: string) {
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(startTime);
  return hasTimezone ? new Date(startTime).toISOString() : startTime;
}

function getValidCachedEntry<T>(entry: CachedValue<T> | null | undefined) {
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry;
}

function clearZoomMeetingCaches() {
  cachedMeetingList = null;
  meetingDetailCache.clear();
  meetingRegistrantCache.clear();
}

function getZoomConfig() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom credentials are not configured on the server.');
  }

  return { accountId, clientId, clientSecret };
}

async function getZoomAccessToken() {
  const cachedToken = cachedZoomToken;
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  if (zoomTokenPromise) {
    return zoomTokenPromise;
  }

  const { accountId, clientId, clientSecret } = getZoomConfig();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: accountId,
  });

  zoomTokenPromise = (async () => {
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body,
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Zoom token request failed: ${message}`);
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };

    if (!data.access_token) {
      throw new Error('Zoom token response did not include an access token.');
    }

    const expiresInMs = Math.max(60 * 1000, (data.expires_in ?? 3600) * 1000 - ZOOM_TOKEN_SAFETY_MS);
    cachedZoomToken = {
      value: data.access_token,
      expiresAt: Date.now() + expiresInMs,
    };

    return data.access_token;
  })();

  try {
    return await zoomTokenPromise;
  } finally {
    zoomTokenPromise = null;
  }
}

export async function createZoomMeeting({
  topic,
  startTime,
  durationMinutes,
  agenda,
  timezone = 'Asia/Taipei',
  password,
  usePmi = false,
  requireRegistration = false,
  waitingRoom = true,
  joinBeforeHost = false,
  hostVideo = false,
  participantVideo = false,
  muteUponEntry = true,
  autoRecording = 'none',
  audio = 'both',
  isRecurring = false,
  recurrence,
}: CreateZoomMeetingInput): Promise<ZoomMeeting> {
  const accessToken = await getZoomAccessToken();
  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      agenda,
      type: isRecurring ? 8 : 2,
      start_time: toZoomStartTime(startTime),
      duration: durationMinutes,
      timezone,
      password: password || undefined,
      recurrence: isRecurring
        ? {
            type: recurrence?.type ?? 2,
            repeat_interval: recurrence?.repeatInterval ?? 1,
            weekly_days: recurrence?.weeklyDays,
            end_times: recurrence?.endTimes ?? 12,
          }
        : undefined,
      settings: {
        use_pmi: usePmi,
        approval_type: requireRegistration ? 0 : 2,
        join_before_host: joinBeforeHost,
        waiting_room: waitingRoom,
        host_video: hostVideo,
        participant_video: participantVideo,
        mute_upon_entry: muteUponEntry,
        auto_recording: autoRecording,
        audio,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom meeting request failed: ${message}`);
  }

  const meeting = (await response.json()) as ZoomMeeting;
  clearZoomMeetingCaches();
  return meeting;
}

export async function listZoomMeetings(): Promise<ZoomMeeting[]> {
  const cachedEntry = getValidCachedEntry(cachedMeetingList);
  if (cachedEntry) {
    return cachedEntry.value;
  }

  const accessToken = await getZoomAccessToken();
  const response = await fetch('https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=30', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom list meetings request failed: ${message}`);
  }

  const data = (await response.json()) as ListZoomMeetingsResult;
  const meetings = data.meetings ?? [];
  cachedMeetingList = {
    value: meetings,
    expiresAt: Date.now() + ZOOM_LIST_TTL_MS,
  };
  return meetings;
}

export async function getZoomMeetingById(meetingId: string | number): Promise<ZoomMeetingDetail | null> {
  const cacheKey = String(meetingId);
  const cachedEntry = getValidCachedEntry(meetingDetailCache.get(cacheKey));
  if (cachedEntry) {
    return cachedEntry.value;
  }

  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    meetingDetailCache.set(cacheKey, {
      value: null,
      expiresAt: Date.now() + ZOOM_DETAIL_TTL_MS,
    });
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom get meeting request failed: ${message}`);
  }

  const detail = (await response.json()) as ZoomMeetingDetail;
  meetingDetailCache.set(cacheKey, {
    value: detail,
    expiresAt: Date.now() + ZOOM_DETAIL_TTL_MS,
  });
  return detail;
}

export async function deleteZoomMeeting(meetingId: string | number) {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (response.status !== 404 && !response.ok) {
    const message = await response.text();
    throw new Error(`Zoom delete meeting request failed: ${message}`);
  }

  clearZoomMeetingCaches();
}

export async function updateZoomMeeting({
  meetingId,
  topic,
  startTime,
  durationMinutes,
  agenda,
  timezone = 'Asia/Taipei',
  password,
  waitingRoom = true,
  joinBeforeHost = false,
  hostVideo = false,
  participantVideo = false,
  muteUponEntry = true,
  autoRecording = 'none',
  audio = 'both',
}: UpdateZoomMeetingInput) {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      agenda,
      start_time: toZoomStartTime(startTime),
      duration: durationMinutes,
      timezone,
      password: password || undefined,
      settings: {
        join_before_host: joinBeforeHost,
        waiting_room: waitingRoom,
        host_video: hostVideo,
        participant_video: participantVideo,
        mute_upon_entry: muteUponEntry,
        auto_recording: autoRecording,
        audio,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom update meeting request failed: ${message}`);
  }

  clearZoomMeetingCaches();
}

export async function listZoomMeetingRegistrants(meetingId: string | number): Promise<ZoomRegistrant[]> {
  const cacheKey = String(meetingId);
  const cachedEntry = getValidCachedEntry(meetingRegistrantCache.get(cacheKey));
  if (cachedEntry) {
    return cachedEntry.value;
  }

  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/registrants?page_size=300`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (response.status === 404) {
    meetingRegistrantCache.set(cacheKey, {
      value: [],
      expiresAt: Date.now() + ZOOM_REGISTRANTS_TTL_MS,
    });
    return [];
  }

  if (response.status === 429) {
    meetingRegistrantCache.set(cacheKey, {
      value: [],
      expiresAt: Date.now() + 15 * 1000,
    });
    return [];
  }

  if (!response.ok) {
    const message = await response.text();
    if (
      message.includes('Registration has not been enabled') ||
      message.includes('meeting:read:list_registrants') ||
      message.includes('registrants')
    ) {
      meetingRegistrantCache.set(cacheKey, {
        value: [],
        expiresAt: Date.now() + ZOOM_REGISTRANTS_TTL_MS,
      });
      return [];
    }
    throw new Error(`Zoom list registrants request failed: ${message}`);
  }

  const data = (await response.json()) as ZoomRegistrantListResult;
  const registrants = data.registrants ?? [];
  meetingRegistrantCache.set(cacheKey, {
    value: registrants,
    expiresAt: Date.now() + ZOOM_REGISTRANTS_TTL_MS,
  });
  return registrants;
}

export async function addZoomMeetingRegistrant({
  meetingId,
  email,
  firstName,
  lastName,
}: AddZoomMeetingRegistrantInput): Promise<ZoomRegistrant> {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      last_name: lastName || undefined,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom add registrant request failed: ${message}`);
  }

  const registrant = (await response.json()) as ZoomRegistrant;
  meetingRegistrantCache.delete(String(meetingId));
  return registrant;
}
