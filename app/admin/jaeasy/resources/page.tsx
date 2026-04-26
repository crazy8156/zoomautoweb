import Link from 'next/link';
import { requireAdminSession } from '../../../lib/admin';
import { getJaeasyResourceSummary, jaeasyResourceCategories } from '../../../lib/jaeasy-resources';

export default async function AdminJaeasyResourcesPage() {
  await requireAdminSession();
  const summary = getJaeasyResourceSummary();

  return (
    <main className='mx-auto max-w-7xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>老師後台 / Jaeasy</p>
          <h1 className='text-3xl font-bold'>自學資源庫</h1>
          <p className='mt-2 text-sm text-slate-600'>
            這一頁先把你提供的 NotebookLM 外部資料整理成可用清單。下一步可以把這些內容再拆成題庫、閱讀文章、每日推薦與後台可編輯資料表。
          </p>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin/jaeasy'>回自學中心後台</Link>
          <Link href='/jaeasy/resources'>看學生版資源庫</Link>
        </div>
      </header>

      <section className='grid gap-4 md:grid-cols-3'>
        <MetricCard label='資源分類' value={`${summary.categoryCount}`} />
        <MetricCard label='總連結數' value={`${summary.resourceCount}`} />
        <MetricCard label='目前狀態' value='靜態整理版' />
      </section>

      <section className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]'>
        <article className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>目前已整理的來源</h2>
          <div className='mt-6 grid gap-5'>
            {jaeasyResourceCategories.map((category) => (
              <article key={category.key} className='rounded border border-slate-200 p-5'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <h3 className='text-lg font-semibold text-slate-950'>{category.title}</h3>
                    <p className='mt-2 text-sm leading-7 text-slate-600'>{category.summary}</p>
                  </div>
                  <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'>{category.resources.length} 筆</span>
                </div>

                <div className='mt-4 grid gap-2'>
                  {category.resources.map((resource) => (
                    <a
                      key={resource.url}
                      href={resource.url}
                      target='_blank'
                      rel='noreferrer'
                      className='rounded border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50'
                    >
                      <span className='font-semibold text-slate-950'>{resource.title}</span>
                      <span className='ml-2 text-slate-500'>{resource.description}</span>
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>下一步建議</h2>
          <div className='mt-4 grid gap-3 text-sm leading-7 text-slate-600'>
            <p>第一步：先保留這份資源庫，當成學生端可直接使用的外部學習入口。</p>
            <p>第二步：把其中適合的內容拆成閱讀文章、單字整理、文法整理與每日推薦。</p>
            <p>第三步：再做成 Supabase 資料表，讓老師可以在後台自行新增、修改、下架。</p>
          </div>

          <div className='mt-6 grid gap-3'>
            <Link className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' href='/admin/jaeasy/content'>
              回內容管理
            </Link>
            <Link className='rounded border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700' href='/jaeasy/resources'>
              開學生版頁面
            </Link>
          </div>
        </aside>
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
