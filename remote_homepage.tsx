import Link from 'next/link';
import { Course, formatCurrency } from './app/lib/domain';
import { supabase } from './app/lib/supabase';

const navItems = [
  { label: '教學方案', href: '#overview' },
  { label: '直播課程', href: '#courses' },
  { label: '上課流程', href: '#flow' },
  { label: '常見問題', href: '#faq' },
];

const supportItems = [
  {
    title: '固定 Zoom 教室連結',
    text: '每堂課都能快速進入既有教室，學生與家長更容易掌握上課節奏。',
  },
  {
    title: '直播互動與課後回放',
    text: '同時兼顧即時提問與課後複習，遠距教學也能保留學習連續性。',
  },
  {
    title: '老師排課與後台管理',
    text: '從新增課程、建立場次到查看預約名單，都能在同一個系統完成。',
  },
];

const modelItems = [
  {
    step: '01',
    title: '一對一精準教學',
    text: '依照學生程度客製教材、節奏與課後任務，適合需要穩定追蹤的學習者。',
  },
  {
    step: '02',
    title: '小班直播互動課',
    text: '固定班級時段上課，保留提問、討論與同儕互動，讓遠距教學不只是單向觀看。',
  },
  {
    step: '03',
    title: '錄播複習加強方案',
    text: '結合課後回放、講義與作業追蹤，幫助沒跟到直播的學生補回進度。',
  },
];

const flowItems = [
  {
    label: '課前',
    title: '收到提醒與上課連結',
    text: '學生在課前取得 Zoom 連結、教材摘要與本次上課重點，進教室前就知道要學什麼。',
  },
  {
    label: '上課中',
    title: '直播講解與即時互動',
    text: '老師可透過白板、畫面分享與提問互動，維持線上課堂的專注度與參與感。',
  },
  {
    label: '課後',
    title: '回放、講義與作業整理',
    text: '學生可重看錄影、下載教材並完成練習，避免只上過一次就失去吸收機會。',
  },
  {
    label: '追蹤',
    title: '老師回饋與補課安排',
    text: '依出席、作業與學習狀態安排後續追蹤，讓遠距教學也保有持續性。',
  },
];

const trustItems = [
  {
    quote: '老師在線上課也會一直確認我們有沒有跟上，互動很多，不像只是放影片。',
    author: '怡安｜高中學生',
  },
  {
    quote: '網站把直播、回放與補課流程都講清楚，作為家長比較放心讓孩子直接在線上學。',
    author: '承翰｜家長',
  },
  {
    quote: '課後回放跟作業追蹤很有幫助，缺課或想重聽某段內容時，不會整個進度掉下來。',
    author: '佩珊｜國中學生',
  },
];

const faqItems = [
  {
    question: '學生需要先安裝 Zoom 才能上課嗎？',
    answer:
      '建議先安裝 Zoom 用戶端，這樣音訊、畫面與互動功能會更穩定，也更方便使用螢幕分享與分組討論。',
  },
  {
    question: '錯過直播課程可以補課嗎？',
    answer:
      '可以。這個平台適合搭配課後回放、補課時段或錄影複習機制，讓學生即使沒跟到直播也能追上進度。',
  },
  {
    question: '之後可以再加報名、登入或課表功能嗎？',
    answer:
      '可以。現有首頁已經保留課程與後台入口，很適合再延伸成正式平台，例如報名表單、學生登入、教師課表與後台管理。',
  },
];

export default async function HomePage() {
  const { data: courses } = await supabase
    .from('courses')
    .select('id,title,description,price,max_students,duration_minutes,is_active,created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30);

  const rows = (courses ?? []) as Course[];

  return (
    <div className='bg-[linear-gradient(180deg,#f6fbff_0%,#eef5ff_46%,#e8f0ff_100%)] text-slate-950'>
      <nav className='sticky top-0 z-50 border-b border-sky-100/80 bg-white/80 backdrop-blur'>
        <div className='mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-5 md:px-8'>
          <div className='flex items-center gap-8'>
            <Link href='/' className='font-sans text-lg font-black tracking-tight text-slate-950 md:text-xl'>
              Zoom eLearning
            </Link>
            <div className='hidden items-center gap-6 md:flex'>
              {navItems.map((item) => (
                <a key={item.label} className='text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950' href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <Link href='/admin/login' className='hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:inline-flex'>
              老師登入
            </Link>
            <a href='#courses' className='inline-flex rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'>
              預約體驗
            </a>
          </div>
        </div>
      </nav>

      <main>
        <section className='relative overflow-hidden px-5 pb-16 pt-14 md:px-8 md:pb-24 md:pt-20'>
          <div className='pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,rgba(11,92,255,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(18,169,207,0.16),transparent_30%)]' />
          <div className='relative mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]'>
            <section className='rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_30px_80px_rgba(30,64,175,0.12)] backdrop-blur md:p-12'>
              <span className='inline-flex rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-700'>Zoom 線上直播教學平台</span>
              <h1 className='mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl md:leading-[1.05]'>
                把遠距上課，
                <br />
                做得更像一間真正有節奏的教室。
              </h1>
              <p className='mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg'>
                這個平台以 Zoom 線上教學為核心，整合直播課程、課後回放、教師排課與預約管理。無論是學生、家長或老師，都能很快掌握上課方式與加入流程。
              </p>
              <div className='mt-8 flex flex-wrap gap-4'>
                <a className='inline-flex items-center gap-2 rounded-full bg-sky-600 px-6 py-3 font-bold text-white transition-transform hover:-translate-y-0.5' href='#courses'>
                  查看直播課程
                  <span className='material-symbols-outlined text-base'>arrow_forward</span>
                </a>
                <a className='inline-flex rounded-full border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50' href='#flow'>
                  了解上課流程
                </a>
              </div>

              <div className='mt-10 grid gap-4 sm:grid-cols-3'>
                <StatCard value='24/7' label='可安排直播與課後回放' />
                <StatCard value='1 對 1' label='支援個別指導與小班互動' />
                <StatCard value='即時' label='點名、提問與課堂討論' />
              </div>
            </section>

            <aside className='rounded-[2rem] bg-[linear-gradient(180deg,#0b5cff_0%,#123f9f_100%)] p-7 text-white shadow-[0_28px_70px_rgba(11,92,255,0.25)]'>
              <span className='inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-100'>
                Why Zoom Classrooms
              </span>
              <h2 className='mt-5 text-3xl font-black leading-tight tracking-tight'>
                直播教學、互動討論與課後複習，放進同一套流程。
              </h2>
              <div className='mt-6 grid gap-4'>
                {supportItems.map((item) => (
                  <article key={item.title} className='rounded-3xl border border-white/12 bg-white/10 p-5'>
                    <h3 className='text-base font-bold text-white'>{item.title}</h3>
                    <p className='mt-2 text-sm leading-7 text-sky-50/90'>{item.text}</p>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section id='overview' className='px-5 py-6 md:px-8 md:py-10'>
          <div className='mx-auto max-w-7xl'>
            <SectionHeader
              eyebrow='Teaching Models'
              title='三種教學方案'
              description='先讓學生與家長理解上課模式，再決定最適合的班別，是線上教學網站非常重要的第一步。'
            />
            <div className='mt-8 grid gap-5 lg:grid-cols-3'>
              {modelItems.map((item) => (
                <article key={item.step} className='rounded-[1.75rem] border border-white/70 bg-white/78 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 font-black text-sky-700'>
                    {item.step}
                  </div>
                  <h3 className='mt-5 text-xl font-black tracking-tight text-slate-950'>{item.title}</h3>
                  <p className='mt-3 leading-8 text-slate-600'>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id='courses' className='px-5 py-10 md:px-8 md:py-14'>
          <div className='mx-auto max-w-7xl'>
            <SectionHeader
              eyebrow='Live Courses'
              title='直播課程'
              description='課程清單直接串接現有資料。當老師在後台建立課程與場次後，學生就能在這裡查看並預約。'
              action={
                <Link className='hidden items-center gap-2 text-sm font-bold text-sky-700 transition-colors hover:text-sky-500 sm:inline-flex' href='/my-bookings'>
                  查詢我的預約
                  <span className='material-symbols-outlined text-lg'>arrow_outward</span>
                </Link>
              }
            />

            <div className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]'>
              <div className='grid gap-5'>
                {rows.length === 0 ? (
                  <div className='rounded-[2rem] border border-dashed border-sky-200 bg-white/75 p-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                    <div className='mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-50'>
                      <span className='material-symbols-outlined text-4xl text-sky-500'>history_edu</span>
                    </div>
                    <h3 className='mt-6 text-2xl font-black tracking-tight text-slate-950'>目前尚未開放直播課程</h3>
                    <p className='mx-auto mt-4 max-w-2xl leading-8 text-slate-600'>
                      你可以先到老師後台新增課程與場次。完成設定後，這裡會自動顯示開放預約的課程資訊與上課安排。
                    </p>
                    <div className='mt-8 flex flex-wrap justify-center gap-3'>
                      <Link className='inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800' href='/admin'>
                        進入老師後台
                        <span className='material-symbols-outlined text-base'>chevron_right</span>
                      </Link>
                      <a className='inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50' href='#faq'>
                        先看常見問題
                      </a>
                    </div>
                  </div>
                ) : (
                  rows.map((course) => (
                    <article key={course.id} className='rounded-[2rem] border border-white/70 bg-white/82 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                      <div className='flex flex-wrap items-start justify-between gap-4'>
                        <div>
                          <p className='text-xs font-bold uppercase tracking-[0.18em] text-sky-700'>Zoom Live Course</p>
                          <h3 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>{course.title}</h3>
                        </div>
                        <p className='rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700'>
                          {formatCurrency(course.price)}
                        </p>
                      </div>
                      <p className='mt-4 max-w-3xl leading-8 text-slate-600'>
                        {course.description ?? '老師尚未填寫課程介紹。'}
                      </p>
                      <dl className='mt-6 grid gap-3 sm:grid-cols-3'>
                        <MetaCard label='課程時長' value={`${course.duration_minutes ?? 60} 分鐘`} />
                        <MetaCard label='名額上限' value={`${course.max_students} 人`} />
                        <MetaCard label='預約狀態' value='開放中' accent />
                      </dl>
                      <div className='mt-6 flex flex-wrap gap-3'>
                        <Link href={`/course/${course.id}`} className='inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800'>
                          查看場次
                          <span className='material-symbols-outlined text-base'>arrow_forward</span>
                        </Link>
                        <Link href='/my-bookings' className='inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50'>
                          我的預約
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <aside className='rounded-[2rem] border border-white/70 bg-white/82 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                <span className='inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-700'>Platform Highlights</span>
                <h3 className='mt-5 text-2xl font-black tracking-tight text-slate-950'>讓學生知道，線上課程不是只有一個 Zoom 連結。</h3>
                <div className='mt-6 grid gap-4'>
                  <div className='rounded-3xl bg-slate-50 p-5'>
                    <strong className='block text-slate-950'>直播教室</strong>
                    <p className='mt-2 text-sm leading-7 text-slate-600'>用固定上課節奏維持出席與互動，降低臨時找不到連結或教材的混亂感。</p>
                  </div>
                  <div className='rounded-3xl bg-slate-50 p-5'>
                    <strong className='block text-slate-950'>課後回放</strong>
                    <p className='mt-2 text-sm leading-7 text-slate-600'>缺課或需要重聽時，可以透過回放與講義補回關鍵內容，不讓進度直接中斷。</p>
                  </div>
                  <div className='rounded-3xl bg-slate-50 p-5'>
                    <strong className='block text-slate-950'>老師後台</strong>
                    <p className='mt-2 text-sm leading-7 text-slate-600'>教師可建立課程、管理場次、檢查預約與更新資訊，讓教學流程更有秩序。</p>
                  </div>
                </div>
                <Link href='/admin' className='mt-6 inline-flex items-center gap-2 text-sm font-bold text-sky-700 transition-colors hover:text-sky-500'>
                  前往老師後台
                  <span className='material-symbols-outlined text-base'>arrow_outward</span>
                </Link>
              </aside>
            </div>
          </div>
        </section>

        <section id='flow' className='px-5 py-10 md:px-8 md:py-14'>
          <div className='mx-auto max-w-7xl'>
            <SectionHeader
              eyebrow='Zoom Class Flow'
              title='上課流程'
              description='把課前提醒、上課互動、課後回放與補課追蹤講清楚，能大幅提升學生與家長對遠距課程的信任感。'
            />
            <div className='mt-8 grid gap-5 lg:grid-cols-4'>
              {flowItems.map((item) => (
                <article key={item.label} className='rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                  <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{item.label}</p>
                  <h3 className='mt-3 text-xl font-black tracking-tight text-slate-950'>{item.title}</h3>
                  <p className='mt-3 leading-8 text-slate-600'>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className='px-5 py-10 md:px-8 md:py-14'>
          <div className='mx-auto max-w-7xl'>
            <SectionHeader
              eyebrow='Testimonials'
              title='學生與家長回饋'
              description='遠距教學最有說服力的內容，往往不是功能清單，而是學生與家長是否真的感受到穩定、清楚與可持續的學習流程。'
            />
            <div className='mt-8 grid gap-5 lg:grid-cols-3'>
              {trustItems.map((item) => (
                <article key={item.author} className='rounded-[1.75rem] border border-white/70 bg-white/82 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
                  <p className='leading-8 text-slate-600'>“{item.quote}”</p>
                  <p className='mt-6 text-sm font-black tracking-tight text-slate-950'>{item.author}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id='faq' className='px-5 py-10 md:px-8 md:py-14'>
          <div className='mx-auto max-w-7xl'>
            <SectionHeader
              eyebrow='FAQ'
              title='常見問題'
              description='這些問題是 Zoom 線上教學網站最常被問到的內容，先在首頁說清楚，後續報名與轉換通常會順很多。'
            />
            <div className='mt-8 grid gap-4'>
              {faqItems.map((item) => (
                <details key={item.question} className='group rounded-[1.5rem] border border-white/70 bg-white/82 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]' open={item.question === faqItems[0].question}>
                  <summary className='flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-black tracking-tight text-slate-950'>
                    <span>{item.question}</span>
                    <span className='material-symbols-outlined text-sky-600 transition-transform group-open:rotate-45'>add</span>
                  </summary>
                  <p className='mt-4 max-w-4xl leading-8 text-slate-600'>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className='px-5 pb-16 pt-8 md:px-8 md:pb-24'>
          <div className='mx-auto max-w-7xl rounded-[2rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-8 text-white shadow-[0_30px_80px_rgba(11,92,255,0.22)] md:p-10'>
            <p className='text-sm font-black uppercase tracking-[0.2em] text-sky-100'>Next Step</p>
            <h2 className='mt-4 text-3xl font-black tracking-tight md:text-5xl'>把 Zoom 直播課程整理成一個更完整的線上教學入口。</h2>
            <p className='mt-4 max-w-3xl text-base leading-8 text-sky-50/90 md:text-lg'>
              這個首頁已經能清楚展示直播課程、後台管理、課後回放與補課追蹤。接下來你可以繼續加上報名表單、老師介紹、學生登入與課表頁面，變成完整教學平台。
            </p>
            <div className='mt-8 flex flex-wrap gap-4'>
              <a className='inline-flex rounded-full bg-white px-6 py-3 font-bold text-slate-950 transition-transform hover:-translate-y-0.5' href='#courses'>
                先看直播課程
              </a>
              <Link className='inline-flex rounded-full border border-white/20 px-6 py-3 font-bold text-white transition-colors hover:bg-white/10' href='/admin'>
                開啟老師後台
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className='border-t border-sky-100 bg-white/90 px-5 py-10 md:px-8'>
        <div className='mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between'>
          <div>
            <p className='text-lg font-black tracking-tight text-slate-950'>Zoom eLearning 線上教學網站</p>
            <p className='mt-2 text-sm text-slate-500'>適合展示直播課程、課後回放與遠距教學流程。</p>
          </div>
          <div className='flex flex-wrap gap-5 text-sm font-semibold text-slate-500'>
            <a className='transition-colors hover:text-slate-950' href='#'>使用條款</a>
            <a className='transition-colors hover:text-slate-950' href='#'>隱私權政策</a>
            <a className='transition-colors hover:text-slate-950' href='#'>聯絡我們</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
      <div>
        <p className='text-sm font-black uppercase tracking-[0.2em] text-sky-700'>{eyebrow}</p>
        <h2 className='mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-5xl'>{title}</h2>
      </div>
      <div className='max-w-2xl'>
        <p className='text-base leading-8 text-slate-600'>{description}</p>
        {action ? <div className='mt-4'>{action}</div> : null}
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <article className='rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-5'>
      <p className='text-2xl font-black tracking-tight text-slate-950'>{value}</p>
      <p className='mt-2 text-sm leading-6 text-slate-600'>{label}</p>
    </article>
  );
}

function MetaCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className='rounded-2xl bg-slate-50 p-4'>
      <dt className='text-sm text-slate-500'>{label}</dt>
      <dd className={`mt-1 text-base font-bold ${accent ? 'text-sky-700' : 'text-slate-950'}`}>{value}</dd>
    </div>
  );
}
