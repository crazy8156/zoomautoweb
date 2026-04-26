import { NextResponse } from 'next/server';
import {
  buildZoomWebhookValidationResponse,
  finalizeZoomMeetingAttendance,
  handleZoomParticipantJoined,
  handleZoomParticipantLeft,
  verifyZoomWebhookSignature,
} from '../../../lib/zoom-attendance';

type ZoomWebhookEnvelope = {
  event?: string;
  payload?: {
    object?: Record<string, unknown>;
  };
};

function normalizeEventName(eventName: string) {
  return String(eventName ?? '').trim().toLowerCase();
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let body: ZoomWebhookEnvelope = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as ZoomWebhookEnvelope) : {};
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const eventName = normalizeEventName(body.event ?? '');

  if (eventName === 'endpoint.url_validation') {
    return NextResponse.json(buildZoomWebhookValidationResponse(body));
  }

  if (!verifyZoomWebhookSignature(rawBody, request.headers)) {
    return NextResponse.json({ message: 'Invalid Zoom webhook signature.' }, { status: 401 });
  }

  if (eventName.endsWith('participant_joined')) {
    await handleZoomParticipantJoined(body);
  } else if (eventName.endsWith('participant_left')) {
    await handleZoomParticipantLeft(body);
  } else if (eventName.endsWith('meeting_ended') || eventName.endsWith('meeting.ended')) {
    await finalizeZoomMeetingAttendance(body);
  }

  return NextResponse.json({ ok: true });
}
