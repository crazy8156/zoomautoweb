import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { normalizeEmail } from './email';
import { supabaseAdmin } from './supabase-admin';

export const JAEASY_COOKIE_NAME = 'jaeasy_session';
const JAEASY_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

export type JaeasySession = {
  userId: string;
  email: string;
  fullName: string | null;
  expiresAt: number;
};

export type JaeasyMemberProfile = {
  id: string;
  email: string;
  fullName: string | null;
  studentId: string | null;
  studentSource: string | null;
};

function getJaeasySecret() {
  return (
    process.env.JAEASY_SESSION_SECRET ||
    process.env.STUDENT_ACCESS_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    'jaeasy-session'
  );
}

function signPayload(payload: string) {
  return createHmac('sha256', getJaeasySecret()).update(payload).digest('hex');
}

function encodeSession(session: JaeasySession) {
  return Buffer.from(JSON.stringify(session)).toString('base64url');
}

function decodeSession(token: string) {
  return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as JaeasySession;
}

export function createJaeasySessionToken(session: JaeasySession) {
  const payload = encodeSession(session);
  return `${payload}.${signPayload(payload)}`;
}

export function verifyJaeasySessionToken(token: string | undefined) {
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(signPayload(payload), 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const session = decodeSession(payload);
    if (!session.userId || !session.email || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function jaeasyCookieOptions() {
  return {
    httpOnly: true,
    maxAge: JAEASY_COOKIE_TTL_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.ADMIN_COOKIE_SECURE === 'true',
  };
}

function createServerAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function syncStudentRecord({
  email,
  fullName,
  source,
}: {
  email: string;
  fullName: string;
  source: string;
}) {
  const normalizedEmail = normalizeEmail(email);

  const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
    .from('students')
    .select('id,source')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingStudentError) {
    throw new Error(`同步 students 失敗：${existingStudentError.message}`);
  }

  if (existingStudent?.id) {
    const { error: updateStudentError } = await supabaseAdmin
      .from('students')
      .update({ name: fullName, source })
      .eq('id', existingStudent.id);

    if (updateStudentError) {
      throw new Error(`更新 students 失敗：${updateStudentError.message}`);
    }

    return existingStudent.id;
  }

  const { data: createdStudent, error: createStudentError } = await supabaseAdmin
    .from('students')
    .insert({
      name: fullName,
      email: normalizedEmail,
      source,
    })
    .select('id')
    .single();

  if (createStudentError) {
    throw new Error(`建立 students 失敗：${createStudentError.message}`);
  }

  return createdStudent.id;
}

export async function registerJaeasyMember({
  email,
  password,
  fullName,
}: {
  email: string;
  password: string;
  fullName: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const displayName = fullName.trim();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      source: 'jaeasy',
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || '建立 Supabase 使用者失敗。');
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    full_name: displayName,
    role: 'student',
  });

  if (profileError) {
    throw new Error(`同步 profiles 失敗：${profileError.message}`);
  }

  await syncStudentRecord({
    email: normalizedEmail,
    fullName: displayName,
    source: 'jaeasy',
  });

  return {
    userId: data.user.id,
    email: normalizedEmail,
    fullName: displayName,
    expiresAt: Date.now() + JAEASY_COOKIE_TTL_SECONDS * 1000,
  } satisfies JaeasySession;
}

export async function loginJaeasyMember({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = createServerAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    throw new Error('登入失敗，請確認帳號密碼。');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`讀取 profiles 失敗：${profileError.message}`);
  }

  const fullName =
    profile?.full_name || (typeof data.user.user_metadata?.full_name === 'string' ? data.user.user_metadata.full_name : '') || 'Jaeasy Student';

  await syncStudentRecord({
    email: normalizedEmail,
    fullName,
    source: 'jaeasy',
  });

  return {
    userId: data.user.id,
    email: normalizedEmail,
    fullName,
    expiresAt: Date.now() + JAEASY_COOKIE_TTL_SECONDS * 1000,
  } satisfies JaeasySession;
}

export async function getJaeasyMemberProfile(userId: string, email: string): Promise<JaeasyMemberProfile | null> {
  const [{ data: profile, error: profileError }, { data: student, error: studentError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('students').select('id,source').eq('email', email).maybeSingle(),
  ]);

  if (profileError) {
    throw new Error(`讀取 profiles 失敗：${profileError.message}`);
  }

  if (studentError) {
    throw new Error(`讀取 students 失敗：${studentError.message}`);
  }

  if (!profile) return null;

  return {
    id: profile.id,
    email,
    fullName: profile.full_name,
    studentId: student?.id ?? null,
    studentSource: student?.source ?? null,
  };
}
