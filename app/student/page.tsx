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
    title: '今天先把節奏拉回來',
    summary: '先完成今天該做的複習，再決定要不要加做測驗。把步驟縮小，學習會更穩。',
    points: ['先完成今日待複習', '再安排一個 20 分鐘的專注時段', '晚上回頭看一次錯題即可'],
  },
  {
    title: '把課堂內容接回自學',
    summary: '今天如果有 Zoom 課，最值得做的是把課堂新內容立刻接到自己的複習清單。',
    points: ['課後 10 分鐘整理新單字', '把不熟的句型另外記下', '先做短練習，不用一次做太多'],
  },
  {
    title: '先穩住固定輸入量',
    summary: '穩定比爆量更重要。每天保持一點輸入，長期效果會比一次衝很多更好。',
    points: ['今天至少讀一段短文', '把新單字放進例句裡', '完成後再看一次發音'],
  },
  {
    title: '把錯題變成今天的主角',
    summary: '測驗最有價值的地方不是分數，而是幫你找到還沒真正理解的地方。',
    points: ['先看最近一題錯題', '找出是單字、文法還是閱讀卡住', '再做一題同級別練習'],
  },
  {
    title: '今天做一個小循環',
    summary: '複習、練習、再回看一次，這種小循環比單純一直看教材更有效。',
    points: ['複習 5 個單字', '完成 1 組小測驗', '回頭重看今天最不熟的一題'],
  },
  {
    title: '先顧今天，再準備下一堂',
    summary: '如果明天或這週還有課，把今天的自學節奏穩住，下一堂的吸收會明顯比較好。',
    points: ['看一下下一堂課主題', '確認自己還不熟的部分', '先補最容易出錯的地方'],
  },
  {
    title: '讓學習保持輕一點',
    summary: '今天不一定要衝很多，只要保持進度不要斷掉，你就已經在前進了。',
    points: ['完成今日待複習', '看一篇短內容', '把學習收在一個清楚的結尾'],
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
    return '已開始';
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
    title: `${memberName} 的今日學習提示`,
    summary: theme.summary,
    points: [
      theme.points[0],
      dueCount > 0 ? `今天有 ${dueCount} 個待複習項目，先把它們清掉。`
      : '今天待複習不多，適合補一點新內容。',
      todayCourseCount > 0 ? `今天有 ${todayCourseCount} 堂課，課後記得把課堂內容接回自學。`
      : '今天沒有排課，適合安排一段完整自學時間。',
      latestLevel ? `最近一次測驗級別是 ${latestLevel}，今天可以延續同級別練習。`
      : '今天可以從一組基礎小測驗開始暖機。',
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
                學生中心
              </h1>
              <p className='mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg'>
                這裡會把今天的複習、課程、Zoom 連結和自學內容整理在一起，讓你一登入就知道先做什麼。
              </p>
            </div>

            <div className='flex flex-wrap gap-3'>
              <Link
                href='/'
                className='rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50'
              >
                回平台入口
              </Link>
              <form action={logoutAction}>
                <button className='rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5'>
                  登出
                </button>
              </form>
            </div>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            <SummaryCard label='學生名稱' value={member.fullName || session.fullName || member.email} />
            <SummaryCard label='今日待複習' value={`${reviewItems.length} 項`} />
            <SummaryCard label='今日課程' value={`${todayScheduleItems.length} 堂`} />
          </div>
        </section>

        <section className='mt-8 grid gap-6 xl:grid-cols-2'>
          <article className='rounded-[2rem] bg-[linear-gradient(135deg,#17304d_0%,#0b5cff_100%)] p-7 text-white shadow-[0_28px_70px_rgba(11,92,255,0.24)] md:p-8'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-100'>今日 Zoom 提醒</p>
                <h2 className='mt-2 text-3xl font-black tracking-tight'>今天 Zoom 上課提醒</h2>
              </div>
              <Link
                href='/student/course-center'
                className='rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10'
              >
                前往課程中心
              </Link>
            </div>

            {nextTodayCourse ? (
              <div className='mt-6 grid gap-4'>
                <div className='rounded-3xl border border-white/12 bg-white/10 p-5'>
                  <p className='text-lg font-black tracking-tight'>{nextTodayCourse.courseTitle}</p>
                  <p className='mt-2 text-sm leading-7 text-sky-50/90'>開始時間：{formatDateTime(nextTodayCourse.session.start_time)}</p>
                  <p className='text-sm leading-7 text-sky-50/90'>距離上課：{formatTimeUntil(nextTodayCourse.startsAt)}</p>
                  <p className='text-sm leading-7 text-sky-50/90'>狀態：{formatBookingStatus(nextTodayCourse.bookingStatus)}</p>
                </div>
                <div className='flex flex-wrap gap-3'>
                  {nextTodayCourse.session.zoom_join_url ? (
                    <a
                      href={nextTodayCourse.session.zoom_join_url}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5'
                    >
                      進入 Zoom
                    </a>
                  ) : (
                    <span className='inline-flex rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white/90'>
                      尚未提供 Zoom 連結
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className='mt-6 rounded-3xl border border-white/12 bg-white/10 p-5 text-sm leading-7 text-sky-50/90'>
                今天沒有排定課程，你可以先完成待複習內容，或直接前往課程中心查看接下來的安排。
              </div>
            )}
          </article>

          <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>我的課表</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>我的課表</h2>
              </div>
              <Link href='/my-bookings' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                查看完整課表
              </Link>
            </div>

            <div className='mt-6 grid gap-4'>
              {scheduleItems.length > 0 ? (
                scheduleItems.slice(0, 5).map((item) => (
                  <article key={item.id} className='rounded-3xl bg-slate-50 p-5'>
                    <div className='flex flex-wrap items-start justify-between gap-4'>
                      <div>
                        <p className='text-lg font-black tracking-tight text-slate-950'>{item.courseTitle}</p>
                        <p className='mt-2 text-sm leading-7 text-slate-600'>開始時間：{formatDateTime(item.session.start_time)}</p>
                        <p className='text-sm leading-7 text-slate-600'>狀態：{formatBookingStatus(item.bookingStatus)}</p>
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
                        <span className='rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600'>等待開課連結</span>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className='rounded-3xl border border-dashed border-slate-200 px-5 py-6 text-sm leading-7 text-slate-600'>
                  目前還沒有課表資料，之後預約成功的課程會自動出現在這裡。
                </div>
              )}
            </div>
          </article>
        </section>

        <section className='mt-8 grid gap-6 xl:grid-cols-2'>
          <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>今日單字</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>今日單字 5 個</h2>
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
                  目前還沒有可顯示的單字，先到自學中心建立你的複習節奏，這裡就會開始出現推薦內容。
                </div>
              )}
            </div>
          </article>

          <article className='rounded-[2rem] border border-white/70 bg-white/84 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-black uppercase tracking-[0.18em] text-sky-700'>每日文章</p>
                <h2 className='mt-2 text-2xl font-black tracking-tight text-slate-950'>每日文章</h2>
              </div>
              <Link href='/jaeasy' className='text-sm font-bold text-sky-700 underline underline-offset-4'>
                前往自學中心
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
