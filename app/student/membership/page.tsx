import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getJaeasyMemberProfile, JAEASY_COOKIE_NAME, verifyJaeasySessionToken } from '../../lib/jaeasy-auth';

const plans = [
  {
    name: '自學會員',
    badge: '自學會員',
    price: '月費規劃中',
    description: '提供單字複習、JLPT 測驗與學習進度追蹤，適合以自學為主的學生。',
    features: ['Jaeasy 自學中心', '單字複習節奏', '測驗紀錄', '進度追蹤'],
  },
  {
    name: '直播課會員',
    badge: 'Zoom 課程',
    price: '課程方案制',
    description: '適合同時需要 Zoom 課表、課程中心與課後複習的學生。',
    features: ['課程中心', 'Zoom 上課入口', '我的課表', '課後回自學中心'],
  },
  {
    name: '進階會員',
    badge: '進階方案',
    price: '即將開放',
    description: '預留給之後的模擬考、回放、作業與進階會員權限。',
    features: ['更多題庫權限', '會員升級入口', '回放 / 作業', '後續串金流'],
  },
];

const roadmap = [
  '現在已經有學生中心與會員方案入口頁。',
  '下一步可以接方案資料表、訂單與付款紀錄。',
  '完成金流串接後，就能依會員方案開放不同權限。',
];

export default async function StudentMembershipPage() {
  const cookieStore = await cookies();
  const session = verifyJaeasySessionToken(cookieStore.get(JAEASY_COOKIE_NAME)?.value);

  if (!session) {
    redirect('/jaeasy/login?next=/student/membership');
  }

  const member = await getJaeasyMemberProfile(session.userId, session.email);
  if (!member) {
    redirect('/jaeasy/login?next=/student/membership');
  }

  return (
    <main className='min-h-full bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_46%,#e7eefb_100%)] px-5 py-10 md:px-8 md:py-14'>
      <div className='mx-auto max-w-7xl'>
        <header className='rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.2em] text-sky-700'>會員方案</p>
              <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl'>會員方案 / 付費入口</h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這一頁先作為學生端的付費入口骨架。現在已經能清楚展示方案方向，後面接金流時就可以直接延伸。
              </p>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/student'
                className='rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回學生中心
              </Link>
              <Link
                href='/student/course-center'
                className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'
              >
                去課程中心
              </Link>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <MetricCard label='會員' value={member.fullName || session.fullName || member.email} />
            <MetricCard label='目前方案' value='方案規劃中' />
            <MetricCard label='付費狀態' value='尚未接金流' />
          </div>
        </header>

        <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]'>
          <div className='grid gap-4 md:grid-cols-3'>
            {plans.map((plan) => (
              <article key={plan.name} className='rounded-[1.75rem] border border-white/70 bg-white/84 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{plan.badge}</p>
                <h2 className='mt-3 text-2xl font-black tracking-tight text-slate-950'>{plan.name}</h2>
                <p className='mt-4 text-xl font-black text-slate-950'>{plan.price}</p>
                <p className='mt-4 text-sm leading-7 text-slate-600'>{plan.description}</p>
                <div className='mt-5 grid gap-2'>
                  {plan.features.map((feature) => (
                    <div key={feature} className='rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700'>
                      {feature}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className='rounded-[2rem] bg-[linear-gradient(180deg,#0b5cff_0%,#123f9f_100%)] p-7 text-white shadow-[0_28px_70px_rgba(11,92,255,0.24)]'>
            <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>付款規劃</p>
            <h2 className='mt-4 text-2xl font-black tracking-tight'>之後怎麼接正式付費</h2>
            <div className='mt-6 grid gap-3'>
              {roadmap.map((item, index) => (
                <article key={item} className='rounded-3xl border border-white/12 bg-white/10 p-4'>
                  <p className='text-xs font-black uppercase tracking-[0.18em] text-sky-100'>第 {index + 1} 步</p>
                  <p className='mt-2 text-sm leading-7 text-sky-50/92'>{item}</p>
                </article>
              ))}
            </div>
            <div className='mt-6 rounded-3xl border border-white/12 bg-white/10 p-4 text-sm leading-7 text-sky-50/92'>
              目前這頁先當方案入口與金流預留位置。等你要正式接付款，我下一步可以幫你補 `plans / orders / payments / entitlements`。
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-5'>
      <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{label}</p>
      <p className='mt-3 text-xl font-black tracking-tight text-slate-950'>{value}</p>
    </article>
  );
}
