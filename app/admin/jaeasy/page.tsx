import Link from 'next/link';
import { requireAdminSession } from '../../lib/admin';
import { getJaeasyAdminOverview } from '../../lib/jaeasy-admin';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '尚無紀錄';

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(value));
}

export default async function AdminJaeasyPage() {
  await requireAdminSession();
  const overview = await getJaeasyAdminOverview();

  return (
    <main className='mx-auto max-w-7xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>老師後台 / Jaeasy</p>
          <h1 className='text-3xl font-bold'>自學中心後台</h1>
          <p className='mt-2 text-sm text-slate-600'>這裡集中管理 Jaeasy 會員、字庫、題庫與目前的出題邏輯。</p>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin'>回平台後台</Link>
          <Link href='/jaeasy'>看前台自學中心</Link>
        </div>
      </header>

      <section className='grid gap-4 md:grid-cols-4'>
        <MetricCard label='註冊會員' value={`${overview.registeredMemberCount}`} />
        <MetricCard label='字庫總量' value={`${overview.contentSummary.vocabularyCount}`} />
        <MetricCard label='手動題庫' value={`${overview.contentSummary.manualQuestionCount}`} />
        <MetricCard label='總作答紀錄' value={`${overview.contentSummary.totalAttemptCount}`} />
      </section>

      <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_340px]'>
        <article className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>目前架構</h2>
          <div className='mt-4 grid gap-4'>
            <ArchitectureCard
              title='會員註冊'
              text='學生在 /jaeasy/login 註冊後，會建立 Supabase Auth 使用者，並同步寫入 profiles 與 students。老師後台看到的註冊名單就是從這裡來。'
            />
            <ArchitectureCard
              title='自學資料'
              text='目前複習進度、手動題庫、作答紀錄是存在專案的 data/jaeasy JSON 檔。這一層已經可用，也已預留 Supabase migration。'
            />
            <ArchitectureCard
              title='出題方式'
              text='單字測驗不是逐題手寫，而是依字庫自動產生題目與選項。文法與閱讀題則來自老師後台新增的手動題庫。'
            />
          </div>
        </article>

        <aside className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>管理入口</h2>
          <div className='mt-4 grid gap-3'>
            <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/students'>
              學生主名單
            </Link>
            <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/jaeasy/content'>
              管理字庫與題庫
            </Link>
            <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/jaeasy/resources'>
              管理學習資源庫
            </Link>
            <Link className='rounded border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700' href='/admin/course-center'>
              前往課程中心
            </Link>
          </div>

          <div className='mt-6 rounded border border-slate-200 bg-slate-50 p-4'>
            <p className='text-sm font-semibold text-slate-500'>出題摘要</p>
            <p className='mt-2 text-sm text-slate-700'>單字自動題：{overview.contentSummary.generatedVocabQuestionCount}</p>
            <p className='mt-1 text-sm text-slate-700'>文法手動題：{overview.contentSummary.grammarQuestionCount}</p>
            <p className='mt-1 text-sm text-slate-700'>閱讀手動題：{overview.contentSummary.readingQuestionCount}</p>
          </div>
        </aside>
      </section>

      <section className='mt-8 rounded border bg-white p-6 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='text-xl font-semibold'>最近作答活動</h2>
            <p className='mt-2 text-sm text-slate-600'>方便老師快速確認學生最近在自學中心的使用情況。</p>
          </div>
          <Link href='/admin/students' className='text-sm font-semibold underline'>
            查看學生主名單
          </Link>
        </div>

        <div className='mt-6 grid gap-3'>
          {overview.recentAttempts.length > 0 ? (
            overview.recentAttempts.map((attempt) => (
              <article key={attempt.id} className='rounded border border-slate-200 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <p className='text-sm font-bold text-sky-700'>
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
            <div className='rounded border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600'>目前還沒有學生作答紀錄。</div>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded border bg-white p-5 shadow-sm'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className='mt-2 text-3xl font-bold'>{value}</p>
    </article>
  );
}

function ArchitectureCard({ title, text }: { title: string; text: string }) {
  return (
    <article className='rounded border border-slate-200 p-4'>
      <h3 className='text-base font-semibold text-slate-950'>{title}</h3>
      <p className='mt-2 text-sm leading-7 text-slate-600'>{text}</p>
    </article>
  );
}
