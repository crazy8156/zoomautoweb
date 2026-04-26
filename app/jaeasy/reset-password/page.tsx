'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

function getHashParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

export default function JaeasyResetPasswordPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('正在確認重設密碼連結...');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => password.length >= 6 && password === confirmPassword, [confirmPassword, password]);

  useEffect(() => {
    let active = true;

    async function bootstrapRecovery() {
      const params = getHashParams();
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const errorDescription = params.get('error_description');

      if (errorDescription) {
        if (!active) return;
        setStatus('error');
        setMessage(decodeURIComponent(errorDescription));
        return;
      }

      if (!accessToken || !refreshToken) {
        if (!active) return;
        setStatus('error');
        setMessage('這個重設密碼連結無效或已過期，請回登入頁重新寄送。');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!active) return;

      if (error) {
        setStatus('error');
        setMessage('無法驗證重設密碼連結，請重新寄送一次。');
        return;
      }

      window.history.replaceState(null, '', window.location.pathname);
      setStatus('ready');
      setMessage('請輸入新密碼。');
    }

    void bootstrapRecovery();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setStatus('error');
      setMessage('請確認兩次輸入的密碼一致，且至少 6 碼。');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus('error');
      setMessage('重設密碼失敗，請重新寄送重設信後再試一次。');
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    setStatus('success');
    setMessage('密碼已更新完成，現在可以回登入頁重新登入。');
    setSubmitting(false);
  }

  return (
    <main className='min-h-full bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_48%,#e7f1ff_100%)] px-5 py-10 md:px-8 md:py-14'>
      <div className='mx-auto max-w-3xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_28px_80px_rgba(30,64,175,0.12)] md:p-12'>
        <p className='text-sm font-black uppercase tracking-[0.2em] text-sky-700'>密碼重設</p>
        <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl'>重設 Jaeasy 密碼</h1>
        <p className='mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700'>{message}</p>

        {status === 'ready' ? (
          <form className='mt-8 grid gap-4' onSubmit={handleSubmit}>
            <label className='text-sm font-semibold text-slate-700'>
              新密碼
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal'
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
                type='password'
                value={password}
              />
            </label>
            <label className='text-sm font-semibold text-slate-700'>
              再輸入一次新密碼
              <input
                className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal'
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type='password'
                value={confirmPassword}
              />
            </label>
            <button
              className='rounded-full bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
              disabled={submitting}
              type='submit'
            >
              {submitting ? '更新中...' : '更新密碼'}
            </button>
          </form>
        ) : null}

        <div className='mt-8 flex flex-wrap gap-3'>
          <Link
            href='/jaeasy/login'
            className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
          >
            回登入頁
          </Link>
          <Link
            href='/jaeasy'
            className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
          >
            回學習中心
          </Link>
        </div>
      </div>
    </main>
  );
}
