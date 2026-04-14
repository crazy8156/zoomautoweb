type ZoomMeeting = {
  id: number;
  join_url: string;
  start_url?: string;
  start_time?: string;
  topic?: string;
};

type CreateZoomMeetingInput = {
  topic: string;
  startTime: string;
  durationMinutes: number;
};

function toZoomStartTime(startTime: string) {
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(startTime);
  return hasTimezone ? new Date(startTime).toISOString() : startTime;
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
  const { accountId, clientId, clientSecret } = getZoomConfig();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: accountId,
  });

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

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error('Zoom token response did not include an access token.');
  }

  return data.access_token;
}

export async function createZoomMeeting({
  topic,
  startTime,
  durationMinutes,
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
      type: 2,
      start_time: toZoomStartTime(startTime),
      duration: durationMinutes,
      timezone: 'Asia/Taipei',
      settings: {
        join_before_host: true,
        waiting_room: false,
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Zoom meeting request failed: ${message}`);
  }

  return (await response.json()) as ZoomMeeting;
}
