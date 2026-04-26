import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getCatalogBreakdown,
  getRecentQuizAttempts,
  getUpcomingReviewItems,
  getUserDueReviewItems,
  getUserLearningSnapshot,
  getVocabularyCatalog,
} from '../lib/jaeasy-data';
import {
  getJaeasyMemberProfile,
  JAEASY_COOKIE_NAME,
  jaeasyCookieOptions,
  verifyJaeasySessionToken,
} from '../lib/jaeasy-auth';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

async function logoutAction() {
  'use server';

  const cookieStore = await cookies();
  cookieStore.set(JAEASY_COOKIE_NAME, '', {
    ...jaeasyCookieOptions(),
    maxAge: 0,
  });
  redirect('/jaeasy/login?next=/jaeasy');
}

async function requireMember(nextPath = '/jaeasy') {
  const cookieStore = await cookies();
  const session = verifyJaeasySessionToken(cookieStore.get(JAEASY_COOKIE_NAME)?.value);

  if (!session) {
    redirect(`/jaeasy/login?next=${encodeURIComponent(nextPath)}`);
  }

  const member = await getJaeasyMemberProfile(session.userId, session.email);

  if (!member) {
    redirect(`/jaeasy/login?next=${encodeURIComponent(nextPath)}`);
  }

  return { session, member };
}

export default async function JaeasyPage() {
  const { session, member } = await requireMember('/jaeasy');

  const [catalogBreakdown, featuredVocabulary, summary, dueReviews, upcomingReviews, recentAttempts] = await Promise.all([
    getCatalogBreakdown(),
    getVocabularyCatalog(),
    getUserLearningSnapshot(member.id),
    getUserDueReviewItems(member.id, 4),
    getUpcomingReviewItems(member.id, 4),
    getRecentQuizAttempts(member.id, 5),
  ]);

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef5ff_46%,#e6eefc_100%)] px-5 py-8 md:px-8 md:py-12'>
      <div className='mx-auto max-w-7xl'>
        <section className='overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>Jaeasy 自學中心</p>
              <h1 className='mt-3 font-["Plus_Jakarta_Sans"] text-4xl font-extrabold tracking-tight text-slate-950 md:text-6xl'>
                你的日文學習首頁
              </h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                在這裡安排今日複習、開始測驗、查看學習記錄，並持續累積自己的 JLPT 字彙與閱讀能力。
              </p>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Link
                href='/student'
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回學生中心
              </Link>
              <form action={logoutAction}>
                <button className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'>
                  登出
                </button>
              </form>
            </div>
          </div>

          <div className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
            <div>
              <div className='mt-2 flex flex-wrap gap-3'>
                <Link
                  href='/jaeasy/review'
                  className='inline-flex rounded-full bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'
                >
                  開始今日複習
                </Link>
                <Link
                  href='/jaeasy/quiz?level=N5&type=vocab'
                  className='inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50'
                >
                  進入 JLPT 測驗
                </Link>
                <Link
                  href='/jaeasy/resources'
                  className='inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50'
                >
                  查看學習資源
                </Link>
              </div>

              <div className='mt-8 grid gap-4 md:grid-cols-4'>
                <MetricCard label='單字總量' value={`${summary.totalVocabulary}`} />
                <MetricCard label='追蹤單字' value={`${summary.trackedVocabulary}`} />
                <MetricCard label='今日待複習' value={`${summary.dueCount}`} />
                <MetricCard label='測驗正確率' value={`${summary.quizStats.accuracy}%`} />
              </div>
            </div>

            <aside className='rounded-[1.75rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-6 text-white shadow-[0_24px_60px_rgba(11,92,255,0.22)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>會員資料</p>
              <h2 className='mt-3 text-2xl font-black tracking-tight'>{member.fullName || session.fullName || member.email}</h2>
              <p className='mt-3 text-sm leading-7 text-sky-50/90'>{member.email}</p>
              <p className='mt-2 text-sm leading-7 text-sky-50/90'>來源：{member.studentSource || 'jaeasy'}</p>
              <p className='mt-6 text-sm leading-7 text-sky-50/90'>
                你目前有 {summary.dueCount} 個待複習單字，已追蹤 {summary.trackedVocabulary} 個單字，最近測驗正確率為 {summary.quizStats.accuracy}%。
              </p>
            </aside>
          </div>
        </section>

        <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]'>
          <div className='grid gap-6'>
            <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>今日複習</p>
                  <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>優先處理的單字</h2>
                </div>
                <Link href='/jaeasy/review' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                  前往複習
                </Link>
              </div>
              <div className='mt-6 grid gap-3'>
                {dueReviews.length > 0 ? (
                  dueReviews.map((item) => (
                    <article key={item.vocab.id} className='rounded-3xl bg-slate-50 p-5'>
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                          <p className='text-lg font-black tracking-tight text-slate-950'>
                            {item.vocab.word} <span className='text-sm font-semibold text-slate-500'>{item.vocab.reading}</span>
                          </p>
                          <p className='mt-1 text-sm text-slate-600'>{item.vocab.meaningZh}</p>
                        </div>
                        <span className='rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600'>{item.vocab.jlptLevel}</span>
                      </div>
                      <p className='mt-3 text-sm leading-7 text-slate-500'>{item.vocab.exampleZh}</p>
                    </article>
                  ))
                ) : (
                  <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                    今天沒有待複習單字，可以去做測驗或繼續瀏覽字庫。
                  </div>
                )}
              </div>
            </article>

            <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>單字分級</p>
                  <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>JLPT 字庫概況</h2>
                </div>
                <Link href='/jaeasy/quiz?level=N5&type=vocab' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                  開始測驗
                </Link>
              </div>

              <div className='mt-6 grid gap-3 md:grid-cols-5'>
                {catalogBreakdown.map((item) => (
                  <article key={item.level} className='rounded-3xl bg-slate-50 p-4'>
                    <p className='text-sm font-semibold text-slate-500'>{item.level}</p>
                    <p className='mt-2 text-2xl font-black tracking-tight text-slate-950'>{item.count}</p>
                    <p className='mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700'>單字</p>
                  </article>
                ))}
              </div>

              <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {featuredVocabulary.slice(0, 6).map((item) => (
                  <article key={item.id} className='rounded-3xl border border-slate-200 p-5'>
                    <div className='flex items-center justify-between gap-3'>
                      <p className='text-lg font-black tracking-tight text-slate-950'>{item.word}</p>
                      <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'>{item.jlptLevel}</span>
                    </div>
                    <p className='mt-1 text-sm text-slate-500'>{item.reading}</p>
                    <p className='mt-3 text-sm leading-7 text-slate-600'>{item.meaningZh}</p>
                    <p className='mt-3 text-sm leading-7 text-slate-500'>{item.exampleZh}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>

          <div className='grid gap-6'>
            <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>接下來的複習</p>
              <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>排程中的項目</h2>
              <div className='mt-6 grid gap-3'>
                {upcomingReviews.length > 0 ? (
                  upcomingReviews.map((item) => (
                    <article key={item.vocab.id} className='rounded-3xl bg-slate-50 p-5'>
                      <p className='text-base font-black tracking-tight text-slate-950'>{item.vocab.word}</p>
                      <p className='mt-1 text-sm text-slate-500'>{item.vocab.meaningZh}</p>
                      <p className='mt-3 text-sm leading-7 text-slate-600'>下次複習：{formatDateTime(item.srs.nextReviewAt)}</p>
                    </article>
                  ))
                ) : (
                  <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                    目前沒有排程中的複習項目。
                  </div>
                )}
              </div>
            </article>

            <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>最近測驗</p>
              <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>答題紀錄</h2>
              <div className='mt-6 grid gap-3'>
                {recentAttempts.length > 0 ? (
                  recentAttempts.map((attempt) => (
                    <article key={attempt.id} className='rounded-3xl bg-slate-50 p-5'>
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>
                          {attempt.jlptLevel} / {attempt.type}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            attempt.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {attempt.isCorrect ? '答對' : '答錯'}
                        </span>
                      </div>
                      <p className='mt-3 text-sm leading-7 text-slate-700'>{attempt.question}</p>
                      <p className='mt-3 text-xs text-slate-500'>{formatDateTime(attempt.answeredAt)}</p>
                    </article>
                  ))
                ) : (
                  <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                    目前還沒有測驗紀錄，先試著做一份小測驗吧。
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded-[1.5rem] border border-white/70 bg-white/84 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className='mt-2 text-3xl font-black tracking-tight text-slate-950'>{value}</p>
    </article>
  );
}
