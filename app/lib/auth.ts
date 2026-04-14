import { createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE_NAME = 'zoom_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured.');
  return secret;
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error('ADMIN_PASSWORD is not configured.');

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function signPayload(payload: string) {
  return createHmac('sha256', getAdminSecret()).update(payload).digest('hex');
}

export function createAdminSessionToken(now = Date.now()) {
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${signPayload(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;

  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;

  const expiresAtNumber = Number(expiresAt);
  if (!Number.isFinite(expiresAtNumber) || expiresAtNumber < Date.now()) return false;

  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(signPayload(expiresAt), 'hex');

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.ADMIN_COOKIE_SECURE === 'true',
  };
}
