import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Booking, CourseSession, firstItem, formatBookingStatus, formatDateTime } from '../lib/domain';
import {
  getJaeasyMemberProfile,
  JAEASY_COOKIE_NAME,
  jaeasyCookieOptions,
  verifyJaeasySessionToken,
} from '../lib/jaeasy-auth';
import { getRecentQuizAttempts, getUserDueReviewItems } from '../lib/jaeasy-data';
import { STUDENT_COOKIE_NAME, verifyStudentAccessToken } from '../lib/student-access';
import { getStudentZoomJoinUrlMap } from '../lib/student-zoom';
import { supabase } from '../lib/supabase';

type BookingWithSession = Booking & {
  course_sessions: CourseSession | CourseSession[] | null;
};

type ScheduleItem = {
  id: string;
  bookingStatus: string;
  courseTitle: string;
  session: CourseSession;
  startsAt: number;
};

type DailyArticle = {
  title: string;
  summary: string;
  points: string[];
};

const articleThemes: DailyArticle[] = [
  {
    title: '今天先把發音和例句連在一起記',
    summary: '先掌握單字的讀音，再搭配一句短例句，記憶會比只背中文意思更牢靠。',
    points: ['先念出讀音再看字義', '今天只挑 5 個字反覆練習', '能造句就代表真的開始會用了'],
  },
  {
    title: '把課前 10 分鐘留給暖身複習',
    summary: '上 Zoom 課前先看一輪待複習單字，進入課堂時會更容易聽懂老師的提問與說明。',
    points: ['課前 10 分鐘快速瀏覽', '先看昨天答錯的字詞', '用耳朵跟嘴巴一起帶動記憶'],
  },
  {
    title: '今天練習把句子說完整',
    summary: '不只知道答案，還要試著把句子完整說出來，語感才會慢慢建立起來。',
    points: ['從簡短句型開始練', '先求清楚再求速度', '把常用句型存成自己的素材'],
  },
  {
    title: '複習不是重背，是把記憶叫回來',
    summary: '看到單字先停一下，試著自己回想讀音和意思，再看答案，效果會比直接閱讀好得多。',
    points: ['先回想，再核對答案', '錯的題目先標記起來', '短時間多次接觸最有效'],
  },
  {
    title: '今天也讓學習節奏保持輕快',
    summary: '穩定學習比一次衝太多更重要。每天完成一小段，就會慢慢累積成可見的進步。',
    points: ['先完成今天的小目標', '每次專注 15 分鐘即可', '留一點餘裕比較能長期維持'],
  },
  {
    title: '測驗不是壓力，是找出還不熟的地方',
    summary: '做題的目的不是追求全對，而是快速看出哪些觀念還需要再加強。',
    points: ['先記錄不熟的題型', '錯題比對題更值得回看', '複習後再做一次會更有感'],
  },
  {
    title: '把今天學到的字用在生活裡',
    summary: '只要能把新單字放進自己的情境裡，記憶會從短期印象變成真正可用的能力。',
    points: ['想一個自己會用到的情境', '用新單字寫一句話', '越貼近日常越容易記住'],
  },
];

async function logoutAction() {
  'use server';

  const cookieStore = await cookies();
  cookieStore.set(JAEASY_COOKIE_NAME, '', {
    ...jaeasyCookieOptions(),
    maxAge: 0,
  });
  redirect('/');
}

function getTaipeiDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function isSameTaipeiDay(left: string | Date, right: string | Date = new Date()) {
  return getTaipeiDateKey(left) === getTaipeiDateKey(right);
}

function formatTimeUntil(timestamp: number) {
  const diffMs = timestamp - Date.now();

  if (diffMs <= 0) {
    return '已經開始';
  }

  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘後`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remainingMinutes > 0 ? `${diffHours} 小時 ${remainingMinutes} 分鐘後` : `${diffHours} 小時後`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天後`;
}

function pickDailyWords<T extends { vocab: { id: number } }>(items: T[], seedKey: string, count: number) {
  return items
    .slice()
    .sort((left, right) => {
      const leftSeed = (left.vocab.id * 97 + seedKey.length * 31) % 997;
      const rightSeed = (right.vocab.id * 97 + seedKey.length * 31) % 997;
      return leftSeed - rightSeed || left.vocab.id - right.vocab.id;
    })
    .slice(0, count);
}

function buildDailyArticle(memberName: string, dueCount: number, todayCourseCount: number, latestLevel?: string | null) {
  const theme = articleThemes[new Date().getDay()];

  return {
    title: `${memberName}，今天的學習提醒`,
    summary: theme.summary,
    points: [
      theme.points[0],
      dueCount > 0 ? `今天有 ${dueCount} 個待複習項目，先完成一輪會比較安心。` : '今天沒有待複習單字，可以把時間留給新進度或測驗。',
      todayCourseCount > 0 ? `今天有 ${todayCourseCount} 堂課程安排，記得提早確認 Zoom 連結。`
      : '今天沒有排定課程，可以安排一次短時間自主練習。',
      latestLevel ? `最近一次測驗等級是 ${latestLevel}，可以延續同一層級再做一回。`
      : '如果今天想先暖身，建議先從 N5 單字測驗開始。',
    ],
  };
}

export default async function StudentPortalPage() {
  const cookieStore = await cookies();
  const session = verifyJaeasySessionToken(cookieStore.get(JAEASY_COOKIE_NAME)?.value);

  if (!session) {
    redirect('/jaeasy/login?next=/student');
  }

  const member = await getJaeasyMemberProfile(session.userId, session.email);
  if (!member) {
    redirect('/jaeasy/login?next=/student');
  }

  const bookingStudentId = verifyStudentAccessToken(cookieStore.get(STUDENT_COOKIE_NAME)?.value);

  const [reviewItems, recentAttempts, bookingRowsResult] = await Promise.all([
    getUserDueReviewItems(member.id, 12),
    getRecentQuizAttempts(member.id, 1),
    bookingStudentId
      ? supabase
          .from('bookings')
          .select(
            'id,status,booked_at,student_id,session_id,course_sessions:session_id(id,start_time,zoom_join_url,zoom_meeting_id,courses:course_id(title))',
          )
          .eq('student_id', bookingStudentId)
          .order('booked_at', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const bookings = ((bookingRowsResult as { data: BookingWithSession[] | null }).data ?? []) as BookingWithSession[];
  const studentZoomJoinUrlMap = await getStudentZoomJoinUrlMap(
    bookingStudentId,
    bookings.map((booking) => firstItem(booking.course_sessions)?.zoom_meeting_id),
  );

  const scheduleItems = bookings
    .map((booking) => {
      const sessionRow = firstItem(booking.course_sessions);
      const course = firstItem(sessionRow?.courses as { title?: string } | { title?: string }[] | null);
      const zoomMeetingId = String(sessionRow?.zoom_meeting_id ?? '').trim();
      const personalizedJoinUrl = zoomMeetingId ? studentZoomJoinUrlMap.get(zoomMeetingId) ?? null : null;

      if (!sessionRow?.start_time) {
        return null;
      }

      return {
        id: booking.id,
        bookingStatus: booking.status,
        courseTitle: course?.title ?? '未命名課程',
        session: {
          ...sessionRow,
          zoom_join_url: personalizedJoinUrl ?? sessionRow.zoom_join_url,
        },
        startsAt: new Date(sessionRow.start_time).getTime(),
      } satisfies ScheduleItem;
    })
    .filter((item): item is ScheduleItem => Boolean(item))
    .sort((left, right) => left.startsAt - right.startsAt);

  const todayScheduleItems = scheduleItems.filter((item) => isSameTaipeiDay(item.session.start_time));
  const nextTodayCourse = todayScheduleItems.find((item) => item.startsAt >= Date.now()) ?? todayScheduleItems[0] ?? null;
  const dailyWords = pickDailyWords(reviewItems, `${member.id}-${getTaipeiDateKey(new Date())}`, 5);
  const latestAttemptLevel = recentAttempts[0]?.jlptLevel ?? null;
  const dailyArticle = buildDailyArticle(
    member.fullName || session.fullName || '同學',
    reviewItems.length,
    todayScheduleItems.length,
    latestAttemptLevel,
  );

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#eef5ff_44%,#e6eefc_100%)] px-5 py-8 md:px-8 md:py-12'>
      <div className='mx-auto max-w-7xl'>
        <section className='overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <p className='text-sm font-black uppercase tracking-[0.22em] text-sky-700'>學生中心</p>
              <h1 className='mt-3 font-["Plus_Jakarta_Sans"] text-4xl font-extrabold tracking-tight text-slate-950 md:text-6xl'>
                學習總覽
              </h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡會幫您整合今天的課程安排、Zoom 上課入口、Jaeasy 複習進度與每日學習提醒，讓您一進來就知道接下來該做什麼。
              </p>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Link
                href='/'
                className='rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回首頁
              </Link>
              <form action={logoutAction}>
                <button className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'>
                  登出
                </button>
              </form>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <SummaryCard label='目前帳號' value={member.fullName || session.fullName || member.email} />
            <SummaryCard label='待複習單字' value={`${reviewItems.length} 個`} />
            <SummaryCard label='今日課程' value={`${todayScheduleItems.length} 堂`} />
          </div>
        </section>

        <section className='mt-8 grid gap-6 xl:grid-cols-2'>
          <article className='rounded-[2rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-7 text-white shadow-[0_28px_70px_rgba(11,92,255,0.24)] md:p-8'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>今日 Zoom 課程</p>
                <h2 className='mt-2 text-3xl font-black tracking-tight'>準備上課</h2>
              </div>
              <Link
                href='/student/course-center'
                className='rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10'
              >
                查看課程中心
              </Link>
            </div>

            {nextTodayCourse ? (
              <div className='mt-6 grid gap-4'>
                <div className='rounded-3xl border border-white/12 bg-white/10 p-5'>
                  <p className='text-lg font-black tracking-tight'>{nextTodayCourse.courseTitle}</p>
                  <p className='mt-2 text-sm leading-7 text-sky-50/90'>上課時間：{formatDateTime(nextTodayCourse.session.start_time)}</p>
                  <p className='text-sm leading-7 text-sky-50/90'>距離開始：{formatTimeUntil(nextTodayCourse.startsAt)}</p>
                  <p className='text-sm leading-7 text-sky-50/90'>預約狀態：{formatBookingStatus(nextTodayCourse.bookingStatus)}</p>
                </div>
                <div className='flex flex-wrap gap-3'>
                  {nextTodayCourse.session.zoom_join_url ? (
                    <a
                      href={nextTodayCourse.session.zoom_join_url}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5'
                    >
                      進入 Zoom 教室
                    </a>
                  ) : (
                    <span className='inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white/90'>
                      尚未建立 Zoom 連結
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className='mt-6 rounded-3xl border border-white/12 bg-white/10 p-5 text-sm leading-7 text-sky-50/90'>
                今天目前沒有安排中的課程。您可以先完成單字複習，或到課程中心查看可預約的課程。
              </div>
            )}
          </article>

          <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>近期課程安排</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>我的上課清單</h2>
              </div>
              <Link href='/my-bookings' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                查看全部預約
              </Link>
            </div>

            <div className='mt-6 grid gap-4'>
              {scheduleItems.length > 0 ? (
                scheduleItems.slice(0, 5).map((item) => (
                  <article key={item.id} className='rounded-3xl bg-slate-50 p-5'>
                    <div className='flex flex-wrap items-start justify-between gap-4'>
                      <div>
                        <p className='text-lg font-black tracking-tight text-slate-950'>{item.courseTitle}</p>
                        <p className='mt-2 text-sm leading-7 text-slate-600'>上課時間：{formatDateTime(item.session.start_time)}</p>
                        <p className='text-sm leading-7 text-slate-600'>預約狀態：{formatBookingStatus(item.bookingStatus)}</p>
                      </div>
                      {item.session.zoom_join_url ? (
                        <a
                          href={item.session.zoom_join_url}
                          target='_blank'
                          rel='noreferrer'
                          className='inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white'
                        >
                          進入課程
                        </a>
                      ) : (
                        <span className='rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600'>尚未建立連結</span>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                  目前還沒有任何課程預約。完成第一筆預約後，這裡會自動顯示您的上課時間與 Zoom 入口。
                </div>
              )}
            </div>
          </article>
        </section>

        <section className='mt-8 grid gap-6 xl:grid-cols-2'>
          <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>今日單字複習</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>建議先看這 5 個字</h2>
              </div>
              <Link href='/jaeasy/review' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                前往複習
              </Link>
            </div>

            <div className='mt-6 grid gap-4'>
              {dailyWords.length > 0 ? (
                dailyWords.map((item) => (
                  <article key={item.vocab.id} className='rounded-3xl bg-slate-50 p-5'>
                    <div className='flex items-start justify-between gap-4'>
                      <div>
                        <p className='text-lg font-black tracking-tight text-slate-950'>
                          {item.vocab.word} <span className='text-sm font-semibold text-slate-500'>{item.vocab.reading}</span>
                        </p>
                        <p className='mt-2 text-sm leading-7 text-slate-600'>{item.vocab.meaningZh}</p>
                      </div>
                      <span className='rounded-full bg-white px-3 py-1 text-xs font-bold text-sky-700'>{item.vocab.jlptLevel}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                  目前沒有待複習的單字。您可以先去做一回測驗，系統之後會自動安排複習節奏。
                </div>
              )}
            </div>
          </article>

          <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>每日提醒</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>今天的學習節奏</h2>
              </div>
              <Link href='/jaeasy' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                前往 Jaeasy
              </Link>
            </div>

            <div className='mt-6 rounded-3xl bg-slate-50 p-6'>
              <p className='text-xl font-black tracking-tight text-slate-950'>{dailyArticle.title}</p>
              <p className='mt-3 text-sm leading-8 text-slate-600'>{dailyArticle.summary}</p>
              <div className='mt-5 grid gap-3'>
                {dailyArticle.points.map((point) => (
                  <div key={point} className='rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700'>
                    {point}
                  </div>
                ))}
              </div>
              <div className='mt-6 flex flex-wrap gap-3'>
                <Link
                  href='/jaeasy/review'
                  className='inline-flex rounded-full bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5'
                >
                  開始今日複習
                </Link>
                <Link
                  href='/student/course-center'
                  className='inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100'
                >
                  查看課程安排
                </Link>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-5'>
      <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>{label}</p>
      <p className='mt-3 text-xl font-black tracking-tight text-slate-950'>{value}</p>
    </article>
  );
}
