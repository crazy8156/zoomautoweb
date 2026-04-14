import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminSessionToken, verifyAdminPassword } from '../../lib/auth';

async function loginAdmin(formData: FormData) {
  'use server';

  const password = String(formData.get('password') ?? '');
  const nextPath = String(formData.get('next') ?? '/admin');

  if (!verifyAdminPassword(password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), adminCookieOptions());
  redirect(nextPath.startsWith('/admin') ? nextPath : '/admin');
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;

  return (
    <main className='flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-950'>
      <section className='w-full max-w-md rounded border bg-white p-6 shadow-sm'>
        <p className='text-sm font-semibold text-emerald-700'>Admin</p>
        <h1 className='mt-2 text-3xl font-bold'>老師後台登入</h1>
        <p className='mt-3 text-sm leading-6 text-slate-600'>
          後台會管理 Zoom 場次，之後也會接 Zalo 與金流資料，請先登入再操作。
        </p>
        {error ? <p className='mt-4 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-700'>密碼不正確，請再試一次。</p> : null}
        <form action={loginAdmin} className='mt-6 space-y-4'>
          <input type='hidden' name='next' value={next ?? '/admin'} />
          <label className='block text-sm font-semibold'>
            後台密碼
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='password' required type='password' autoComplete='current-password' />
          </label>
          <button className='w-full rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white'>登入後台</button>
        </form>
      </section>
    </main>
  );
}
