import Link from 'next/link';

export default function HomePage() {
  return (
    <main className='relative min-h-screen overflow-hidden bg-[#f8f9fa] text-[#191c1d]'>
      <div className='pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(0,63,135,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,63,135,0.05)_1px,transparent_1px)] bg-[size:40px_40px]' />

      <section className='mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 py-14'>
        <div className='max-w-2xl text-center'>
          <div className='mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_8px_24px_rgba(0,63,135,0.08)]'>
            <span className='material-symbols-outlined fill text-5xl text-[#003f87]'>developer_board</span>
          </div>
          <h1 className='mt-8 font-["Plus_Jakarta_Sans"] text-5xl font-extrabold tracking-tight text-[#191c1d] md:text-6xl'>
            ZOOM ELEARNING
          </h1>
          <p className='mx-auto mt-5 max-w-xl text-lg leading-8 text-[#424752]'>
            目前首頁先保留兩個主要入口，學生從這裡進入學習平台，教師從這裡進入老師後台管理。
          </p>
        </div>

        <div className='mt-14 grid w-full max-w-5xl gap-8 md:grid-cols-2'>
          <Link
            href='/jaeasy/login?next=/student'
            className='group relative block rounded-[2rem] border border-[#c2c6d4]/20 bg-white p-10 shadow-[0_8px_24px_rgba(0,63,135,0.08)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_16px_32px_rgba(0,63,135,0.12)]'
          >
            <div className='absolute left-0 top-0 h-2 w-full rounded-t-[2rem] bg-gradient-to-r from-[#003f87] to-[#0056b3]' />
            <div className='flex h-full flex-col'>
              <div className='mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#d1e4fd]'>
                <span className='material-symbols-outlined fill text-3xl text-[#003f87]'>school</span>
              </div>
              <h2 className='font-["Plus_Jakarta_Sans"] text-3xl font-bold text-[#191c1d]'>
                學生登入
                <span className='mt-2 block text-xl font-medium text-[#424752]'>進入學習平台</span>
              </h2>
              <p className='mt-4 flex-grow leading-8 text-[#424752]'>
                從這裡進入學生中心、自學中心、課程中心，以及你的 Zoom 上課入口。
              </p>
              <div className='mt-10'>
                <span className='inline-flex w-full items-center justify-center rounded-full bg-[#f3f4f5] px-6 py-4 font-medium text-[#003f87] transition-colors group-hover:bg-[#003f87] group-hover:text-white'>
                  進入學生入口
                  <span className='material-symbols-outlined ml-2 text-xl'>arrow_forward</span>
                </span>
              </div>
            </div>
          </Link>

          <Link
            href='/admin/login'
            className='group relative block rounded-[2rem] border border-[#c2c6d4]/20 bg-white p-10 shadow-[0_8px_24px_rgba(0,63,135,0.08)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_16px_32px_rgba(0,63,135,0.12)]'
          >
            <div className='absolute left-0 top-0 h-2 w-full rounded-t-[2rem] bg-gradient-to-r from-[#003f87] to-[#0056b3]' />
            <div className='flex h-full flex-col'>
              <div className='mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#d1e4fd]'>
                <span className='material-symbols-outlined fill text-3xl text-[#003f87]'>admin_panel_settings</span>
              </div>
              <h2 className='font-["Plus_Jakarta_Sans"] text-3xl font-bold text-[#191c1d]'>
                教師登入
                <span className='mt-2 block text-xl font-medium text-[#424752]'>進入老師後台管理</span>
              </h2>
              <p className='mt-4 flex-grow leading-8 text-[#424752]'>
                從這裡管理 Zoom 課程、學生名單、自學平台內容，以及整體教學流程。
              </p>
              <div className='mt-10'>
                <span className='inline-flex w-full items-center justify-center rounded-full bg-[#f3f4f5] px-6 py-4 font-medium text-[#003f87] transition-colors group-hover:bg-[#003f87] group-hover:text-white'>
                  進入教師入口
                  <span className='material-symbols-outlined ml-2 text-xl'>arrow_forward</span>
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className='mt-16 text-center'>
          <div className='inline-flex items-center text-sm text-[#424752] transition-colors hover:text-[#003f87]'>
            <span className='material-symbols-outlined mr-2 text-lg'>help_outline</span>
            如果登入或帳號有問題，請聯絡管理者協助處理。
          </div>
        </div>
      </section>

      <footer className='relative z-10 border-t-0 bg-slate-50 py-10'>
        <div className='mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-12 text-sm md:flex-row'>
          <div className='text-lg font-bold text-slate-900'>ZOOM ELEARNING</div>
          <div className='text-slate-500'>© 2026 Zoom eLearning 教學平台。</div>
          <nav className='flex flex-wrap gap-6'>
            <Link className='text-slate-500 transition-colors hover:text-blue-600' href='/jaeasy/login?next=/student'>
              學生入口
            </Link>
            <Link className='text-slate-500 transition-colors hover:text-blue-600' href='/admin/login'>
              教師入口
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
