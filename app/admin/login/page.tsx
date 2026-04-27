import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminSessionToken, verifyAdminPassword } from '../../lib/auth';

function normalizeNextPath(nextPath: string | undefined) {
  if (!nextPath || !nextPath.startsWith('/admin') || nextPath.startsWith('//')) {
    return '/admin';
  }

  return nextPath;
}

async function loginAdmin(formData: FormData) {
  'use server';

  const password = String(formData.get('password') ?? '');
  const nextPath = normalizeNextPath(String(formData.get('next') ?? '/admin'));

  if (!verifyAdminPassword(password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), adminCookieOptions());
  redirect(nextPath);
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  return (
    <main className='min-h-screen bg-[#f8f9fa] text-slate-900'>
      <div className='fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(17,92,185,0.10),_transparent_32%),linear-gradient(180deg,#f8f9fa_0%,#eef4fb_100%)]' />

      <section className='mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]'>
        <article className='rounded-[2rem] border border-slate-200/70 bg-white/82 p-8 shadow-[0_18px_48px_rgba(0,63,135,0.08)] backdrop-blur-xl md:p-12'>
          <div className='inline-flex items-center gap-2 rounded-full bg-[#d1e4fd] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#003f87]'>
            <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-[#003f87]'>管</span>
            後台登入
          </div>
          <p className='mt-8 text-sm font-black uppercase tracking-[0.22em] text-[#115cb9]'>老師管理入口</p>
          <h1 className='mt-4 text-5xl font-black tracking-[-0.05em] text-[#003f87] md:text-6xl'>老師後台登入</h1>
          <p className='mt-6 max-w-2xl text-lg leading-8 text-slate-600'>
            從這裡進入管理中心，可查看課程安排、學生名單、自學內容，以及整體教學流程與 Zoom 課程設定。
          </p>

          <div className='mt-10 grid gap-4 sm:grid-cols-2'>
            <div className='rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5'>
              <p className='text-xs font-black uppercase tracking-[0.14em] text-slate-400'>課程與教室</p>
              <p className='mt-3 text-lg font-black tracking-tight text-slate-950'>管理直播課程與場次</p>
              <p className='mt-2 text-sm leading-7 text-slate-600'>可在後台安排 Zoom 課程、調整上課時間，並查看每一堂課的進度與狀態。</p>
            </div>
            <div className='rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5'>
              <p className='text-xs font-black uppercase tracking-[0.14em] text-slate-400'>學生與內容</p>
              <p className='mt-3 text-lg font-black tracking-tight text-slate-950'>掌握學生資料與自學內容</p>
              <p className='mt-2 text-sm leading-7 text-slate-600'>可以查看學生名單、預約資訊、自學紀錄，以及後續需要調整的教學內容。</p>
            </div>
          </div>
        </article>

        <article className='rounded-[2rem] border border-slate-200/70 bg-white p-8 shadow-[0_18px_48px_rgba(0,63,135,0.10)] md:p-10'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs font-black uppercase tracking-[0.16em] text-slate-400'>管理中心入口</p>
              <h2 className='mt-2 text-3xl font-black tracking-tight text-slate-950'>登入老師後台</h2>
            </div>
            <Link href='/' className='rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'>
              回首頁
            </Link>
          </div>

          {error ? (
            <div className='mt-6 rounded-[1.4rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700'>
              密碼錯誤，請重新輸入老師後台密碼。
            </div>
          ) : (
            <div className='mt-6 rounded-[1.4rem] border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700'>
              請輸入老師後台密碼，登入後即可進入管理中心。
            </div>
          )}

          <form action={loginAdmin} className='mt-8 grid gap-4'>
            <input type='hidden' name='next' value={nextPath} />
            <label className='text-sm font-semibold text-slate-700'>
              老師後台密碼
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal shadow-sm'
                name='password'
                required
                type='password'
                autoComplete='current-password'
                placeholder='請輸入老師後台密碼'
              />
            </label>
            <button className='rounded-full bg-[linear-gradient(180deg,#003f87_0%,#0056b3_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(0,63,135,0.16)] transition-transform hover:-translate-y-0.5'>
              進入老師後台
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
