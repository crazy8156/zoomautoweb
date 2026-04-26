import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { gradeReviewItem, getUpcomingReviewItems, getUserDueReviewItems, getUserLearningSnapshot } from '../../lib/jaeasy-data';
import { getJaeasyMemberProfile, JAEASY_COOKIE_NAME, verifyJaeasySessionToken } from '../../lib/jaeasy-auth';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

async function requireMember(nextPath = '/jaeasy/review') {
  const cookieStore = await cookies();
  const session = verifyJaeasySessionToken(cookieStore.get(JAEASY_COOKIE_NAME)?.value);

  if (!session) {
    redirect(`/jaeasy/login?next=${encodeURIComponent(nextPath)}`);
  }

  const member = await getJaeasyMemberProfile(session.userId, session.email);

  if (!member) {
    redirect(`/jaeasy/login?next=${encodeURIComponent(nextPath)}`);
  }

  return member;
}

async function gradeAction(formData: FormData) {
  'use server';

  const member = await requireMember();
  const vocabId = Number(formData.get('vocabId') ?? 0);
  const grade = Number(formData.get('grade') ?? -1);

  await gradeReviewItem(member.id, vocabId, grade);
  redirect('/jaeasy/review?graded=1');
}

export default async function JaeasyReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember('/jaeasy/review');
  const params = await searchParams;
  const graded = (Array.isArray(params.graded) ? params.graded[0] : params.graded) === '1';
  const [summary, dueReviews, upcomingReviews] = await Promise.all([
    getUserLearningSnapshot(member.id),
    getUserDueReviewItems(member.id, 8),
    getUpcomingReviewItems(member.id, 5),
  ]);

  return (
    <main className='min-h-full bg-[linear-gradient(180deg,#fffef8_0%,#f6fbff_48%,#eef3ff_100%)] px-5 py-10 md:px-8 md:py-14'>
      <div className='mx-auto max-w-7xl'>
        <header className='rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>複習系統</p>
              <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl'>今日單字複習</h1>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/jaeasy'
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回 Jaeasy
              </Link>
              <Link
                href='/jaeasy/quiz?level=N5&type=vocab'
                className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'
              >
                去做測驗
              </Link>
            </div>
          </div>

          <p className='mt-6 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
            請依照熟悉程度為每個單字打分。`0` 代表完全不熟，`5` 代表非常熟悉。系統會依照您的評分自動調整下次複習時間。
          </p>

          {graded ? (
            <div className='mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700'>
              已更新這個單字的複習結果，系統會重新安排下次複習時間。
            </div>
          ) : null}

          <div className='mt-8 grid gap-4 md:grid-cols-4'>
            <MetricCard label='待複習單字' value={`${summary.dueCount}`} />
            <MetricCard label='今日已複習' value={`${summary.reviewedToday}`} />
            <MetricCard label='追蹤中的單字' value={`${summary.trackedVocabulary}`} />
            <MetricCard label='已熟練單字' value={`${summary.masteredCount}`} />
          </div>
        </header>

        <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_340px]'>
          <div className='grid gap-5'>
            {dueReviews.length > 0 ? (
              dueReviews.map((item) => (
                <article
                  key={item.vocab.id}
                  className='rounded-[2rem] border border-white/70 bg-white/86 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'
                >
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{item.vocab.jlptLevel}</p>
                      <h2 className='mt-2 text-3xl font-black tracking-tight text-slate-950'>{item.vocab.word}</h2>
                      <p className='mt-1 text-base text-slate-500'>{item.vocab.reading}</p>
                    </div>
                    <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'>{item.vocab.pos}</span>
                  </div>

                  <div className='mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.9fr)]'>
                    <div className='rounded-3xl bg-slate-50 p-5'>
                      <p className='text-sm font-semibold text-slate-500'>中文意思</p>
                      <p className='mt-2 text-xl font-black tracking-tight text-slate-950'>{item.vocab.meaningZh}</p>
                      <p className='mt-4 text-sm leading-7 text-slate-600'>{item.vocab.exampleJa}</p>
                      <p className='mt-2 text-sm leading-7 text-slate-500'>{item.vocab.exampleZh}</p>
                    </div>
                    <div className='rounded-3xl bg-slate-50 p-5'>
                      <p className='text-sm font-semibold text-slate-500'>複習紀錄</p>
                      <p className='mt-2 text-sm leading-7 text-slate-600'>累積次數：{item.srs.repetitions}</p>
                      <p className='mt-1 text-sm leading-7 text-slate-600'>熟悉係數：{item.srs.easeFactor.toFixed(2)}</p>
                      <p className='mt-1 text-sm leading-7 text-slate-600'>上次評分：{item.srs.lastGrade}</p>
                    </div>
                  </div>

                  <form action={gradeAction} className='mt-6'>
                    <input name='vocabId' type='hidden' value={item.vocab.id} />
                    <div className='grid gap-3 md:grid-cols-6'>
                      {[0, 1, 2, 3, 4, 5].map((grade) => (
                        <button
                          key={grade}
                          className={`rounded-2xl px-4 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                            grade >= 4
                              ? 'bg-emerald-50 text-emerald-700'
                              : grade === 3
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                          }`}
                          name='grade'
                          type='submit'
                          value={grade}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </form>
                </article>
              ))
            ) : (
              <article className='rounded-[2rem] border border-white/70 bg-white/86 p-7 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>複習完成</p>
                <h2 className='mt-3 text-3xl font-black tracking-tight text-slate-950'>今天沒有待複習單字</h2>
                <p className='mt-4 text-base leading-8 text-slate-600'>
                  目前所有排程中的單字都已處理完畢。您可以回到首頁繼續學習，或先做一回測驗來建立新的複習內容。
                </p>
                <div className='mt-6 flex flex-wrap justify-center gap-3'>
                  <Link
                    href='/jaeasy/quiz?level=N5&type=vocab'
                    className='rounded-full bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'
                  >
                    開始測驗
                  </Link>
                  <Link
                    href='/jaeasy'
                    className='rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50'
                  >
                    回 Jaeasy 首頁
                  </Link>
                </div>
              </article>
            )}
          </div>

          <aside className='grid gap-5'>
            <article className='rounded-[2rem] border border-white/70 bg-white/86 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>接下來的排程</p>
              <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>即將到來的複習</h2>
              <div className='mt-6 grid gap-3'>
                {upcomingReviews.length > 0 ? (
                  upcomingReviews.map((item) => (
                    <article key={item.vocab.id} className='rounded-3xl bg-slate-50 p-4'>
                      <p className='text-base font-black tracking-tight text-slate-950'>{item.vocab.word}</p>
                      <p className='mt-1 text-sm text-slate-500'>{item.vocab.meaningZh}</p>
                      <p className='mt-3 text-xs text-slate-500'>{formatDateTime(item.srs.nextReviewAt)}</p>
                    </article>
                  ))
                ) : (
                  <p className='rounded-3xl border border-dashed border-slate-200 px-4 py-5 text-sm leading-7 text-slate-600'>
                    目前沒有後續複習排程，之後新的單字加入後會再自動安排。
                  </p>
                )}
              </div>
            </article>

            <article className='rounded-[2rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-6 text-white shadow-[0_24px_60px_rgba(11,92,255,0.22)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>評分說明</p>
              <h2 className='mt-3 text-2xl font-black tracking-tight'>怎麼打分最準</h2>
              <div className='mt-5 grid gap-3 text-sm leading-7 text-sky-50/90'>
                <p>0 到 1 分：幾乎想不起來，或完全不知道這個字的意思。</p>
                <p>2 到 3 分：有印象，但還不穩定，需要再看幾次。</p>
                <p>4 到 5 分：可以快速辨認，甚至能自己用出來。</p>
              </div>
            </article>
          </aside>
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
