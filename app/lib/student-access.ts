import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

export const STUDENT_COOKIE_NAME = 'zoom_student_access';
const STUDENT_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

function getStudentSecret() {
  return process.env.STUDENT_ACCESS_SECRET || process.env.ADMIN_SESSION_SECRET || 'zoom-student-access';
}

function signStudentPayload(payload: string) {
  return createHmac('sha256', getStudentSecret()).update(payload).digest('hex');
}

export function createStudentAccessToken(studentId: string, now = Date.now()) {
  const expiresAt = now + STUDENT_COOKIE_TTL_SECONDS * 1000;
  const payload = `${studentId}.${expiresAt}`;
  return `${payload}.${signStudentPayload(payload)}`;
}

export function verifyStudentAccessToken(token: string | undefined) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 7) return null;

  const [a, b, c, d, e, expiresAt, signature] = parts;
  const studentId = `${a}-${b}-${c}-${d}-${e}`;
  const expiresAtNumber = Number(expiresAt);

  if (!Number.isFinite(expiresAtNumber) || expiresAtNumber < Date.now()) return null;

  const payload = `${studentId}.${expiresAt}`;
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(signStudentPayload(payload), 'hex');

  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? studentId : null;
}

export function studentCookieOptions() {
  return {
    httpOnly: true,
    maxAge: STUDENT_COOKIE_TTL_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.ADMIN_COOKIE_SECURE === 'true',
  };
}

export function createStudentId() {
  return randomUUID();
}
