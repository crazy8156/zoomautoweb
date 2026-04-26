import Link from 'next/link';
import { jaeasyResourceCategories, getJaeasyResourceSummary } from '../../lib/jaeasy-resources';

export default function JaeasyResourcesPage() {
  const summary = getJaeasyResourceSummary();

  return (
    <main className='min-h-full bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef5ff_46%,#e6eefc_100%)] px-5 py-10 md:px-8 md:py-14'>
      <div className='mx-auto max-w-7xl'>
        <header className='rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>自學資源</p>
              <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl'>Jaeasy 資源整理</h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡收集了適合搭配 Jaeasy 使用的日文學習網站、影音頻道、文章整理與延伸工具，
                方便你在課後持續練習與補充。
              </p>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/jaeasy'
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回 Jaeasy 首頁
              </Link>
              <Link
                href='/student'
                className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'
              >
                前往學生中心
              </Link>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <MetricCard label='資源分類' value={`${summary.categoryCount}`} />
            <MetricCard label='收錄連結' value={`${summary.resourceCount}`} />
            <MetricCard label='適用內容' value='單字 / 文法 / 閱讀 / 聽力' />
          </div>
        </header>

        <section className='mt-8 grid gap-6'>
          {jaeasyResourceCategories.map((category) => (
            <article key={category.key} className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{category.resources.length} 個推薦</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>{category.title}</h2>
                <p className='mt-2 text-sm leading-7 text-slate-600'>{category.summary}</p>
              </div>

              <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {category.resources.map((resource) => (
                  <a
                    key={resource.url}
                    href={resource.url}
                    target='_blank'
                    rel='noreferrer'
                    className='rounded-3xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-sky-200 hover:bg-sky-50/60'
                  >
                    <p className='text-lg font-black tracking-tight text-slate-950'>{resource.title}</p>
                    <p className='mt-3 text-sm leading-7 text-slate-600'>{resource.description}</p>
                    <p className='mt-4 text-xs font-bold uppercase tracking-[0.18em] text-sky-700'>前往查看</p>
                  </a>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded-3xl bg-slate-50 p-5'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className='mt-2 text-3xl font-black tracking-tight text-slate-950'>{value}</p>
    </article>
  );
}
