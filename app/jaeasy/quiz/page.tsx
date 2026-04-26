import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getRecentQuizAttempts,
  getUserLearningSnapshot,
  getUserQuizQuestionSet,
  submitQuizAnswers,
} from '../../lib/jaeasy-data';
import { getJaeasyMemberProfile, JAEASY_COOKIE_NAME, verifyJaeasySessionToken } from '../../lib/jaeasy-auth';
import type { JlptLevel, QuizMode } from '../../lib/jaeasy';

const allowedLevels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const allowedTypes: QuizMode[] = ['vocab', 'grammar', 'reading'];

function normalizeLevel(value: string | string[] | undefined): JlptLevel {
  const candidate = Array.isArray(value) ? value[0] : value;
  return allowedLevels.includes(candidate as JlptLevel) ? (candidate as JlptLevel) : 'N5';
}

function normalizeType(value: string | string[] | undefined): QuizMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return allowedTypes.includes(candidate as QuizMode) ? (candidate as QuizMode) : 'vocab';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

function buildQuizPath(level: JlptLevel, type: QuizMode) {
  return `/jaeasy/quiz?level=${level}&type=${type}`;
}

async function requireMember(nextPath: string) {
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

async function submitQuizAction(formData: FormData) {
  'use server';

  const level = normalizeLevel(String(formData.get('level') ?? 'N5'));
  const type = normalizeType(String(formData.get('type') ?? 'vocab'));
  const member = await requireMember(buildQuizPath(level, type));
  const questionIds = String(formData.get('questionIds') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (questionIds.length === 0) {
    redirect(`/jaeasy/quiz?level=${level}&type=${type}&error=目前沒有可提交的題目`);
  }

  const answers = questionIds.map((questionId) => {
    const rawValue = formData.get(`answer_${questionId}`);
    return {
      questionId,
      selectedIndex: Number(rawValue ?? NaN),
    };
  });

  if (answers.some((item) => !Number.isInteger(item.selectedIndex))) {
    redirect(`/jaeasy/quiz?level=${level}&type=${type}&error=請先完成所有題目再送出`);
  }

  const result = await submitQuizAnswers(member.id, answers);
  redirect(`/jaeasy/quiz?level=${level}&type=${type}&submitted=1&score=${result.correctCount}&total=${result.totalCount}`);
}

export default async function JaeasyQuizPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const level = normalizeLevel(params.level);
  const type = normalizeType(params.type);
  const member = await requireMember(buildQuizPath(level, type));
  const submitted = (Array.isArray(params.submitted) ? params.submitted[0] : params.submitted) === '1';
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const score = Number(Array.isArray(params.score) ? params.score[0] : params.score ?? 0);
  const total = Number(Array.isArray(params.total) ? params.total[0] : params.total ?? 0);

  const [questions, summary, recentAttempts] = await Promise.all([
    getUserQuizQuestionSet(level, type, 5),
    getUserLearningSnapshot(member.id),
    getRecentQuizAttempts(member.id, 6),
  ]);

  return (
    <main className='min-h-full bg-[linear-gradient(180deg,#f9fbff_0%,#eef5ff_45%,#e9efff_100%)] px-5 py-10 md:px-8 md:py-14'>
      <div className='mx-auto max-w-7xl'>
        <header className='rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>測驗中心</p>
              <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl'>JLPT 測驗中心</h1>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/jaeasy'
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回會員中心
              </Link>
              <Link
                href='/jaeasy/review'
                className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'
              >
                回複習頁
              </Link>
            </div>
          </div>

          <p className='mt-6 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
            測驗會直接保存到你的站內紀錄，現在可以在單字、文法與閱讀三種模式間切換，逐步累積自己的正確率和練習量。
          </p>

          {submitted ? (
            <div className='mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700'>
              本次測驗完成，答對 {score} / {total} 題。
            </div>
          ) : null}

          {error ? (
            <div className='mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700'>{error}</div>
          ) : null}

          <div className='mt-8 grid gap-4 md:grid-cols-4'>
            <MetricCard label='累積作答' value={`${summary.quizStats.totalAttempts}`} />
            <MetricCard label='答對題數' value={`${summary.quizStats.correctCount}`} />
            <MetricCard label='整體正確率' value={`${summary.quizStats.accuracy}%`} />
            <MetricCard label='今日待複習' value={`${summary.dueCount}`} />
          </div>
        </header>

        <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_340px]'>
          <div className='grid gap-6'>
            <article className='rounded-[2rem] border border-white/70 bg-white/86 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>篩選條件</p>
                  <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>選擇測驗模式</h2>
                </div>
              </div>

              <form className='mt-6 grid gap-4 md:grid-cols-3'>
                <label className='text-sm font-semibold text-slate-700'>
                  JLPT 等級
                  <select
                    className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal'
                    defaultValue={level}
                    name='level'
                  >
                    {allowedLevels.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className='text-sm font-semibold text-slate-700'>
                  模式
                  <select
                    className='mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal'
                    defaultValue={type}
                    name='type'
                  >
                    <option value='vocab'>單字</option>
                    <option value='grammar'>文法</option>
                    <option value='reading'>閱讀</option>
                  </select>
                </label>
                <div className='flex items-end'>
                  <button className='w-full rounded-full bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'>
                    重新出題
                  </button>
                </div>
              </form>
            </article>

            <article className='rounded-[2rem] border border-white/70 bg-white/86 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>目前題組</p>
                  <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>
                    {level} / {type} 題組
                  </h2>
                </div>
                <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'>{questions.length} 題</span>
              </div>

              {questions.length > 0 ? (
                <form action={submitQuizAction} className='mt-6 grid gap-5'>
                  <input name='level' type='hidden' value={level} />
                  <input name='type' type='hidden' value={type} />
                  <input name='questionIds' type='hidden' value={questions.map((item) => item.id).join(',')} />

                  {questions.map((question, index) => (
                    <fieldset key={question.id} className='rounded-3xl bg-slate-50 p-5'>
                      <legend className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>第 {index + 1} 題</legend>
                      <p className='mt-3 text-base font-semibold leading-8 text-slate-900'>{question.question}</p>
                      <div className='mt-5 grid gap-3'>
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={`${question.id}-${optionIndex}`}
                            className='flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50'
                          >
                            <input name={`answer_${question.id}`} required type='radio' value={optionIndex} />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}

                  <button className='rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'>
                    送出測驗
                  </button>
                </form>
              ) : (
                <div className='mt-6 rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                  這個篩選條件目前沒有題目，可以先切換別的等級或模式。
                </div>
              )}
            </article>
          </div>

          <aside className='grid gap-5'>
            <article className='rounded-[2rem] border border-white/70 bg-white/86 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>最近作答</p>
              <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>最新作答</h2>
              <div className='mt-6 grid gap-3'>
                {recentAttempts.length > 0 ? (
                  recentAttempts.map((attempt) => (
                    <article key={attempt.id} className='rounded-3xl bg-slate-50 p-4'>
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <p className='text-xs font-black uppercase tracking-[0.18em] text-sky-700'>
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
                  <p className='rounded-3xl border border-dashed border-slate-200 px-4 py-5 text-sm leading-7 text-slate-600'>
                    送出第一份測驗後，這裡就會開始累積你的作答紀錄。
                  </p>
                )}
              </div>
            </article>

            <article className='rounded-[2rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-6 text-white shadow-[0_24px_60px_rgba(11,92,255,0.22)]'>
              <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>測驗提醒</p>
              <h2 className='mt-3 text-2xl font-black tracking-tight'>建議使用方式</h2>
              <div className='mt-5 grid gap-3 text-sm leading-7 text-sky-50/90'>
                <p>先用 `vocab` 把字義練熟，再切到 `grammar` 或 `reading`。</p>
                <p>如果今天待複習數量高，先做 review 再回來做 quiz，效果會更穩。</p>
                <p>送出後成績會留在會員資料裡，之後可以持續累積。</p>
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
