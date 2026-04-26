import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getJaeasyMemberProfile, JAEASY_COOKIE_NAME, verifyJaeasySessionToken } from '../../lib/jaeasy-auth';

const plans = [
  {
    name: 'Jaeasy 自學會員',
    badge: '自學方案',
    price: '已啟用',
    description: '提供單字複習、JLPT 測驗、學習記錄與日常自學內容，適合每天持續累積。',
    features: ['Jaeasy 學習首頁', '單字複習排程', '測驗練習紀錄', '個人學習追蹤'],
  },
  {
    name: '直播課程學員',
    badge: '課程方案',
    price: '依課程安排',
    description: '適合有參與直播教學的學生，可查看課程、場次與專屬上課連結。',
    features: ['課程資訊總覽', 'Zoom 上課入口', '課程中心', '預約與場次安排'],
  },
  {
    name: '整合會員方案',
    badge: '進階方案',
    price: '規劃中',
    description: '未來會把直播課程與 Jaeasy 自學整合成同一套完整學習體驗。',
    features: ['自學與課程整合', '個人進度同步', '學習成果統整', '更多功能擴充'],
  },
];

const roadmap = [
  '補上正式會員方案與可視化訂閱狀態。',
  '整合付款、方案權限與啟用流程。',
  '讓自學記錄與課程進度可以一起查看。',
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
              <p className='text-sm font-black uppercase tracking-[0.2em] text-sky-700'>會員資訊</p>
              <h1 className='mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl'>會員方案與權限</h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡會整理你目前可使用的學習功能、課程權限，以及未來會開放的整合方案。
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
                前往課程中心
              </Link>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <MetricCard label='會員名稱' value={member.fullName || session.fullName || member.email} />
            <MetricCard label='目前狀態' value='已啟用' />
            <MetricCard label='整合進度' value='持續建置中' />
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
            <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>後續規劃</p>
            <h2 className='mt-4 text-2xl font-black tracking-tight'>接下來會補上的內容</h2>
            <div className='mt-6 grid gap-3'>
              {roadmap.map((item, index) => (
                <article key={item} className='rounded-3xl border border-white/12 bg-white/10 p-4'>
                  <p className='text-xs font-black uppercase tracking-[0.18em] text-sky-100'>步驟 {index + 1}</p>
                  <p className='mt-2 text-sm leading-7 text-sky-50/92'>{item}</p>
                </article>
              ))}
            </div>
            <div className='mt-6 rounded-3xl border border-white/12 bg-white/10 p-4 text-sm leading-7 text-sky-50/92'>
              目前這一頁先提供會員狀態與方案說明。之後若要接正式訂閱機制，我們會再補上
              `plans`、`orders`、`payments`、`entitlements` 這些資料層。
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
