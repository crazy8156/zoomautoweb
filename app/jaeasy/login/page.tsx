import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { normalizeEmail } from '../../lib/email';
import { supabaseAdmin } from '../../lib/supabase-admin';
import {
  createJaeasySessionToken,
  jaeasyCookieOptions,
  JAEASY_COOKIE_NAME,
  loginJaeasyMember,
  registerJaeasyMember,
} from '../../lib/jaeasy-auth';

function getSingleValue(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function normalizeAuthMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('already been registered')) {
    return '這個 Email 已經註冊過，請直接登入。';
  }

  if (normalized.includes('invalid login credentials')) {
    return '登入失敗，請確認 Email 和密碼是否正確。';
  }

  if (normalized.includes('password')) {
    return '密碼格式不正確，請輸入至少 6 碼。';
  }

  return message;
}

function normalizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//') || nextPath.startsWith('/admin')) {
    return '/student';
  }

  return nextPath;
}

function buildLoginPath(
  mode: 'smart' | 'register' | 'login' | 'forgot',
  options: {
    email?: string;
    error?: string;
    info?: string;
    next?: string;
    showForgot?: boolean;
  } = {},
) {
  const search = new URLSearchParams();
  search.set('mode', mode);

  if (options.email) search.set('email', options.email);
  if (options.error) search.set('error', options.error);
  if (options.info) search.set('info', options.info);
  if (options.next) search.set('next', options.next);
  if (options.showForgot) search.set('showForgot', '1');

  return `/jaeasy/login?${search.toString()}`;
}

async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || 'zoom.autowise.cc';
  const protocol = requestHeaders.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

async function hasJaeasyAccount(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('email', normalizedEmail)
    .eq('source', 'jaeasy')
    .maybeSingle();

  if (error) {
    throw new Error(`查詢會員資料失敗：${error.message}`);
  }

  return Boolean(data?.id);
}

async function smartAuthAction(formData: FormData) {
  'use server';

  const email = normalizeEmail(getSingleValue(formData.get('email')));
  const password = getSingleValue(formData.get('password'));
  const nextPath = normalizeNextPath(getSingleValue(formData.get('next')));

  if (!email || !password) {
    redirect(buildLoginPath('smart', { error: '請先輸入 Email 和密碼。', next: nextPath }));
  }

  const exists = await hasJaeasyAccount(email);

  if (!exists) {
    redirect(
      buildLoginPath('register', {
        email,
        info: '這個 Email 還沒有帳號，請直接完成註冊。',
        next: nextPath,
      }),
    );
  }

  let session;

  try {
    session = await loginJaeasyMember({ email, password });
  } catch (error) {
    const message = normalizeAuthMessage(error instanceof Error ? error.message : '登入失敗');
    redirect(buildLoginPath('forgot', { email, error: message, next: nextPath, showForgot: true }));
  }

  const cookieStore = await cookies();
  cookieStore.set(JAEASY_COOKIE_NAME, createJaeasySessionToken(session), jaeasyCookieOptions());
  redirect(nextPath);
}

async function registerAction(formData: FormData) {
  'use server';

  const fullName = getSingleValue(formData.get('fullName'));
  const email = normalizeEmail(getSingleValue(formData.get('email')));
  const password = getSingleValue(formData.get('password'));
  const nextPath = normalizeNextPath(getSingleValue(formData.get('next')));

  if (!fullName || !email || !password) {
    redirect(buildLoginPath('register', { email, error: '請完整填寫姓名、Email 和密碼。', next: nextPath }));
  }

  let session;

  try {
    session = await registerJaeasyMember({ fullName, email, password });
  } catch (error) {
    const message = normalizeAuthMessage(error instanceof Error ? error.message : '註冊失敗');
    const mode = message.includes('請直接登入') ? 'login' : 'register';
    redirect(buildLoginPath(mode, { email, error: message, next: nextPath }));
  }

  const cookieStore = await cookies();
  cookieStore.set(JAEASY_COOKIE_NAME, createJaeasySessionToken(session), jaeasyCookieOptions());
  redirect(nextPath);
}

async function loginAction(formData: FormData) {
  'use server';

  const email = normalizeEmail(getSingleValue(formData.get('email')));
  const password = getSingleValue(formData.get('password'));
  const nextPath = normalizeNextPath(getSingleValue(formData.get('next')));

  if (!email || !password) {
    redirect(buildLoginPath('forgot', { email, error: '請先輸入 Email 和密碼。', next: nextPath, showForgot: true }));
  }

  let session;

  try {
    session = await loginJaeasyMember({ email, password });
  } catch (error) {
    const message = normalizeAuthMessage(error instanceof Error ? error.message : '登入失敗');
    redirect(buildLoginPath('forgot', { email, error: message, next: nextPath, showForgot: true }));
  }

  const cookieStore = await cookies();
  cookieStore.set(JAEASY_COOKIE_NAME, createJaeasySessionToken(session), jaeasyCookieOptions());
  redirect(nextPath);
}

async function forgotPasswordAction(formData: FormData) {
  'use server';

  const email = normalizeEmail(getSingleValue(formData.get('email')));
  const nextPath = normalizeNextPath(getSingleValue(formData.get('next')));

  if (!email) {
    redirect(buildLoginPath('forgot', { error: '請輸入要寄送重設信的 Email。', next: nextPath, showForgot: true }));
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/jaeasy/reset-password`,
  });

  if (error) {
    const message = normalizeAuthMessage(error.message || '寄送重設信失敗');
    redirect(buildLoginPath('forgot', { email, error: message, next: nextPath, showForgot: true }));
  }

  redirect(
    buildLoginPath('forgot', {
      email,
      info: '重設密碼信已寄出，請到信箱收信並依照連結完成設定。',
      next: nextPath,
      showForgot: true,
    }),
  );
}

function LoginShell({
  children,
  title,
  description,
  kicker,
  badge,
  error,
  info,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  kicker: string;
  badge: string;
  error?: string;
  info?: string;
}) {
  return (
    <main className='min-h-screen bg-[#f8f9fa] text-slate-900'>
      <div className='fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(17,92,185,0.10),_transparent_32%),linear-gradient(180deg,#f8f9fa_0%,#eef4fb_100%)]' />

      <section className='mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]'>
        <article className='rounded-[2rem] border border-slate-200/70 bg-white/82 p-8 shadow-[0_18px_48px_rgba(0,63,135,0.08)] backdrop-blur-xl md:p-12'>
          <div className='inline-flex items-center gap-2 rounded-full bg-[#d1e4fd] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#003f87]'>
            <span className='material-symbols-outlined text-base'>account_circle</span>
            {badge}
          </div>
          <p className='mt-8 text-sm font-black uppercase tracking-[0.22em] text-[#115cb9]'>{kicker}</p>
          <h1 className='mt-4 text-5xl font-black tracking-[-0.05em] text-[#003f87] md:text-6xl'>{title}</h1>
          <p className='mt-6 max-w-2xl text-lg leading-8 text-slate-600'>{description}</p>

          <div className='mt-10 grid gap-4 sm:grid-cols-2'>
            <div className='rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5'>
              <p className='text-xs font-black uppercase tracking-[0.14em] text-slate-400'>智慧登入</p>
              <p className='mt-3 text-lg font-black tracking-tight text-slate-950'>先輸入一次帳密</p>
              <p className='mt-2 text-sm leading-7 text-slate-600'>有帳號就直接登入，沒有帳號就自動切到註冊。</p>
            </div>
            <div className='rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5'>
              <p className='text-xs font-black uppercase tracking-[0.14em] text-slate-400'>帳號安全</p>
              <p className='mt-3 text-lg font-black tracking-tight text-slate-950'>密碼錯誤可重設</p>
              <p className='mt-2 text-sm leading-7 text-slate-600'>第一次登入失敗時，會直接引導到忘記密碼流程。</p>
            </div>
          </div>
        </article>

        <article className='rounded-[2rem] border border-slate-200/70 bg-white p-8 shadow-[0_18px_48px_rgba(0,63,135,0.10)] md:p-10'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs font-black uppercase tracking-[0.16em] text-slate-400'>登入入口</p>
              <h2 className='mt-2 text-3xl font-black tracking-tight text-slate-950'>{title}</h2>
            </div>
            <Link href='/' className='rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'>
              回平台入口
            </Link>
          </div>

          {error ? (
            <div className='mt-6 rounded-[1.4rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700'>{error}</div>
          ) : null}
          {info ? (
            <div className='mt-4 rounded-[1.4rem] border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700'>{info}</div>
          ) : null}

          <div className='mt-8'>{children}</div>
        </article>
      </section>
    </main>
  );
}

export default async function JaeasyLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawError = params.error;
  const rawInfo = params.info;
  const rawMode = params.mode;
  const rawEmail = params.email;
  const rawNext = params.next;
  const rawShowForgot = params.showForgot;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;
  const info = Array.isArray(rawInfo) ? rawInfo[0] : rawInfo;
  const mode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
  const initialEmail = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const nextPath = normalizeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  const showForgot = (Array.isArray(rawShowForgot) ? rawShowForgot[0] : rawShowForgot) === '1' || mode === 'forgot';

  const currentMode = mode === 'register' || mode === 'login' || mode === 'forgot' ? mode : 'smart';

  return (
    <LoginShell
      badge='學生登入'
      kicker='Jaeasy 智慧登入入口'
      title='學生登入'
      description='輸入 Email 和密碼後，系統會自動判斷是直接登入、註冊新帳號，還是帶你走忘記密碼流程。'
      error={error}
      info={info}
    >
      {currentMode === 'smart' ? (
        <>
          <p className='text-sm font-black uppercase tracking-[0.16em] text-[#115cb9]'>第一步</p>
          <h3 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>輸入帳號密碼</h3>
          <p className='mt-3 text-sm leading-7 text-slate-600'>系統會先檢查這個 Email 是否已存在，再決定要直接登入還是轉去註冊。</p>

          <form action={smartAuthAction} className='mt-6 grid gap-4'>
            <input type='hidden' name='next' value={nextPath} />
            <label className='text-sm font-semibold text-slate-700'>
              電子郵件
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                defaultValue={initialEmail ?? ''}
                name='email'
                placeholder='請輸入你的電子郵件'
                required
                type='email'
              />
            </label>
            <label className='text-sm font-semibold text-slate-700'>
              密碼
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                name='password'
                required
                type='password'
              />
            </label>
            <button className='rounded-full bg-[linear-gradient(180deg,#003f87_0%,#0056b3_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,63,135,0.16)] transition-transform hover:-translate-y-0.5'>
              繼續
            </button>
          </form>
        </>
      ) : null}

      {currentMode === 'register' ? (
        <>
          <p className='text-sm font-black uppercase tracking-[0.16em] text-[#115cb9]'>註冊</p>
          <h3 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>建立新帳號</h3>
          <p className='mt-3 text-sm leading-7 text-slate-600'>這個 Email 還沒有註冊，完成姓名、Email 和密碼後就能直接建立學生帳號。</p>

          <form action={registerAction} className='mt-6 grid gap-4'>
            <input type='hidden' name='next' value={nextPath} />
            <label className='text-sm font-semibold text-slate-700'>
              姓名
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                name='fullName'
                placeholder='請輸入學生姓名'
                required
              />
            </label>
            <label className='text-sm font-semibold text-slate-700'>
              電子郵件
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                defaultValue={initialEmail ?? ''}
                name='email'
                placeholder='請輸入你的電子郵件'
                required
                type='email'
              />
            </label>
            <label className='text-sm font-semibold text-slate-700'>
              密碼
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                minLength={6}
                name='password'
                placeholder='至少 6 碼'
                required
                type='password'
              />
            </label>
            <div className='flex flex-wrap gap-3'>
              <button className='rounded-full bg-[linear-gradient(180deg,#003f87_0%,#0056b3_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,63,135,0.16)] transition-transform hover:-translate-y-0.5'>
                建立帳號
              </button>
              <Link
                href={buildLoginPath('smart', { email: initialEmail ?? '', next: nextPath })}
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回智慧登入
              </Link>
            </div>
          </form>
        </>
      ) : null}

      {currentMode === 'login' || currentMode === 'forgot' ? (
        <>
          <p className='text-sm font-black uppercase tracking-[0.16em] text-[#115cb9]'>登入</p>
          <h3 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>登入學生中心</h3>
          <p className='mt-3 text-sm leading-7 text-slate-600'>如果這個 Email 已經註冊，直接輸入密碼即可進入學生中心。密碼錯誤時也可在下方重設。</p>

          <form action={loginAction} className='mt-6 grid gap-4'>
            <input type='hidden' name='next' value={nextPath} />
            <label className='text-sm font-semibold text-slate-700'>
              電子郵件
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                defaultValue={initialEmail ?? ''}
                name='email'
                placeholder='請輸入你的電子郵件'
                required
                type='email'
              />
            </label>
            <label className='text-sm font-semibold text-slate-700'>
              密碼
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                name='password'
                required
                type='password'
              />
            </label>
            <div className='flex flex-wrap gap-3'>
              <button className='rounded-full bg-[#003f87] px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'>
                直接登入
              </button>
              <Link
                href={buildLoginPath('smart', { email: initialEmail ?? '', next: nextPath })}
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回智慧登入
              </Link>
            </div>
          </form>

          {showForgot ? (
            <div className='mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5'>
              <p className='text-sm font-black uppercase tracking-[0.16em] text-[#115cb9]'>忘記密碼</p>
              <h4 className='mt-2 text-xl font-black tracking-tight text-slate-950'>忘記密碼</h4>
              <p className='mt-2 text-sm leading-7 text-slate-600'>輸入 Email 後，系統會寄送重設密碼信到你的信箱。</p>
              <form action={forgotPasswordAction} className='mt-4 grid gap-3'>
                <input type='hidden' name='next' value={nextPath} />
                <input
                  className='block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm'
                  defaultValue={initialEmail ?? ''}
                  name='email'
                  placeholder='請輸入你的電子郵件'
                  type='email'
                />
                <button className='rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100'>
                  寄出重設信
                </button>
              </form>
            </div>
          ) : null}
        </>
      ) : null}
    </LoginShell>
  );
}
