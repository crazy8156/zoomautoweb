import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '../../lib/admin';
import { Course } from '../../lib/domain';
import { supabase } from '../../lib/supabase';
import { createZoomMeeting } from '../../lib/zoom';

async function createZoomSession(formData: FormData) {
  'use server';

  await requireAdminSession();

  const courseId = String(formData.get('courseId') ?? '');
  const topic = String(formData.get('topic') ?? '我的會議').trim();
  const agenda = String(formData.get('agenda') ?? '').trim();
  const meetingDate = String(formData.get('meetingDate') ?? '');
  const startClock = String(formData.get('startClock') ?? '');
  const durationMinutes = Number(formData.get('durationMinutes') ?? 60);
  const timezone = String(formData.get('timezone') ?? 'Asia/Taipei');
  const password = String(formData.get('password') ?? '').trim();
  const usePmi = formData.get('meetingIdType') === 'pmi';
  const waitingRoom = formData.get('waitingRoom') === 'on';
  const requireRegistration = false;
  const joinBeforeHost = formData.get('joinBeforeHost') === 'on';
  const muteUponEntry = formData.get('muteUponEntry') === 'on';
  const autoRecordingRaw = String(formData.get('autoRecording') ?? 'none');
  const autoRecording = autoRecordingRaw === 'local' || autoRecordingRaw === 'cloud' ? autoRecordingRaw : 'none';
  const audioRaw = String(formData.get('audio') ?? 'voip');
  const audio = audioRaw === 'telephony' || audioRaw === 'both' ? audioRaw : 'voip';
  const hostVideo = String(formData.get('hostVideo') ?? 'off') === 'on';
  const participantVideo = String(formData.get('participantVideo') ?? 'off') === 'on';
  const isRecurring = formData.get('isRecurring') === 'on';
  const recurrenceTypeRaw = String(formData.get('recurrenceType') ?? 'weekly');
  const recurrenceType = recurrenceTypeRaw === 'daily' ? 1 : recurrenceTypeRaw === 'monthly' ? 3 : 2;
  const repeatInterval = Number(formData.get('repeatInterval') ?? 1);
  const weeklyDays = (formData.getAll('weeklyDays') as string[]).filter(Boolean).join(',');
  const endTimes = Number(formData.get('endTimes') ?? 12);

  if (!courseId) throw new Error('請先選擇要排程的課程。');
  if (!meetingDate || !startClock) throw new Error('請填寫日期與開始時間。');
  if (!topic) throw new Error('請填寫課程主題。');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('請填寫正確的持續時間。');
  const startTime = `${meetingDate}T${startClock}`;

  const meeting = await createZoomMeeting({
    topic,
    startTime,
    durationMinutes,
    agenda: agenda || undefined,
    timezone,
    password: password || undefined,
    usePmi,
    requireRegistration,
    waitingRoom,
    joinBeforeHost,
    muteUponEntry,
    autoRecording,
    audio,
    hostVideo,
    participantVideo,
    isRecurring,
    recurrence: isRecurring
      ? {
          type: recurrenceType,
          repeatInterval: Number.isFinite(repeatInterval) && repeatInterval > 0 ? repeatInterval : 1,
          weeklyDays: weeklyDays || undefined,
          endTimes: Number.isFinite(endTimes) && endTimes > 0 ? endTimes : 12,
        }
      : undefined,
  });

  const { error } = await supabase.from('course_sessions').insert({
    course_id: courseId,
    start_time: startTime,
    zoom_join_url: meeting.join_url,
    zoom_meeting_id: meeting.id,
  });
  if (error) throw new Error(`Zoom 會議已建立，但寫入 Supabase 場次失敗：${error.message}`);

  revalidatePath('/admin');
  revalidatePath('/admin/courses');
  revalidatePath('/admin/sessions');
}

export default async function AdminCoursesPage() {
  const { data } = await supabase.from('courses').select('id,title').order('created_at', { ascending: false }).limit(50);
  const courses = (data ?? []) as Pick<Course, 'id' | 'title'>[];
  const defaultPasscode = '123456';
  const today = new Date();
  const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <main className='min-h-screen bg-[#f9f9ff] text-[#121c2b]'>
      <div className='mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-12'>
        <header className='mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between'>
          <div>
            <nav className='mb-4 flex gap-2 text-xs font-medium text-[#6c7b6f]'>
              <span className='font-bold text-[#121c2b]'>Jade Academy</span>
              <span>/</span>
              <span>課程管理</span>
              <span>/</span>
              <span className='font-bold text-[#006d43]'>排程課程會議</span>
            </nav>
            <h1 className='text-4xl font-extrabold tracking-tight'>排程課程會議</h1>
          </div>
          <div className='flex gap-4'>
            <Link className='px-6 py-3 text-sm font-semibold text-[#6c7b6f] hover:text-[#121c2b]' href='/admin'>
              取消
            </Link>
            <button className='rounded-xl bg-[#00d084] px-8 py-3 text-sm font-bold text-[#005331] shadow-sm hover:scale-[1.02]' form='schedule-form' type='submit'>
              儲存並發布
            </button>
          </div>
        </header>

        <form action={createZoomSession} className='grid grid-cols-12 gap-8' id='schedule-form'>
          <div className='col-span-12 space-y-8 lg:col-span-8'>
            <section className='rounded-xl bg-white p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.04)]'>
              <div className='mb-8 flex items-center gap-3'>
                <span className='text-[#006d43]'>☰</span>
                <h2 className='text-xl font-bold'>基本資訊</h2>
              </div>
              <div className='space-y-6'>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>課程</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue={courses[0]?.id ?? ''} name='courseId' required>
                    <option value='' disabled>請選擇課程</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>課程主題</label>
                  <input className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue={courses[0]?.title ?? '我的會議'} name='topic' placeholder='例如：進階微積分 - 第五週：多元函數微分學' required />
                </div>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>課程描述</label>
                  <textarea className='w-full resize-none rounded-lg bg-[#f0f3ff] px-4 py-4' name='agenda' placeholder='請輸入課程大綱或課前準備事項...' rows={4} />
                </div>
              </div>
            </section>

            <section className='rounded-xl bg-white p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.04)]'>
              <div className='mb-8 flex items-center gap-3'>
                <span className='text-[#006d43]'>🕒</span>
                <h2 className='text-xl font-bold'>時間與週期</h2>
              </div>
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>日期</label>
                  <input className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue={dateValue} name='meetingDate' type='date' />
                </div>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>開始時間</label>
                  <input className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue='13:00' name='startClock' type='time' />
                </div>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>持續時間</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue='60' name='durationMinutes'>
                    <option value='45'>45 分鐘</option>
                    <option value='60'>60 分鐘</option>
                    <option value='90'>90 分鐘</option>
                    <option value='120'>120 分鐘</option>
                  </select>
                </div>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>時區</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue='Asia/Taipei' name='timezone'>
                    <option value='Asia/Taipei'>(GMT+08:00) 台北</option>
                    <option value='UTC'>(GMT+00:00) 倫敦</option>
                    <option value='America/New_York'>(GMT-05:00) 紐約</option>
                  </select>
                </div>
              </div>
              <div className='mt-8 border-t border-[#bacbbd]/20 pt-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <span className='font-semibold'>定期會議設定</span>
                  <input className='h-5 w-5' name='isRecurring' type='checkbox' />
                </div>
                <p className='text-sm text-[#6c7b6f]'>開啟後，您可以設定每日、每週或每月的自動排程。</p>
                <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-3'>
                  <select className='rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='weekly' name='recurrenceType'>
                    <option value='daily'>每日</option>
                    <option value='weekly'>每週</option>
                    <option value='monthly'>每月</option>
                  </select>
                  <input className='rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='1' min='1' name='repeatInterval' type='number' />
                  <input className='rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='12' min='1' name='endTimes' type='number' />
                </div>
                <div className='mt-3 flex flex-wrap gap-3 text-sm'>
                  {[
                    ['1', '一'],
                    ['2', '二'],
                    ['3', '三'],
                    ['4', '四'],
                    ['5', '五'],
                    ['6', '六'],
                    ['7', '日'],
                  ].map(([value, label]) => (
                    <label key={value} className='flex items-center gap-1'>
                      <input defaultChecked={value === '1'} name='weeklyDays' type='checkbox' value={value} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className='rounded-xl bg-white p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.04)]'>
              <div className='mb-8 flex items-center gap-3'>
                <span className='text-[#006d43]'>🛡</span>
                <h2 className='text-xl font-bold'>會議設定與安全性</h2>
              </div>
              <div className='grid grid-cols-1 gap-8 md:grid-cols-2'>
                <div className='space-y-4'>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>會議 ID</label>
                  <div className='flex gap-4 text-sm'>
                    <label className='flex items-center gap-2'>
                      <input defaultChecked name='meetingIdType' type='radio' value='auto' />
                      自動產生
                    </label>
                    <label className='flex items-center gap-2'>
                      <input name='meetingIdType' type='radio' value='pmi' />
                      個人會議 ID
                    </label>
                  </div>
                </div>
                <div>
                  <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>存取密碼</label>
                  <input className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4' defaultValue={defaultPasscode} name='password' />
                </div>
              </div>
              <div className='mt-8 space-y-4'>
                <label className='flex items-center justify-between rounded-lg bg-[#f0f3ff] p-4'>
                  <span className='text-sm font-semibold'>啟用等候室</span>
                  <input defaultChecked name='waitingRoom' type='checkbox' />
                </label>
                <label className='flex items-center justify-between rounded-lg bg-[#f0f3ff] p-4'>
                  <span className='text-sm font-semibold'>學員註冊控管（即將推出）</span>
                  <input disabled type='checkbox' />
                </label>
                <p className='text-xs text-[#6c7b6f]'>等學生註冊與專屬 Zoom join link 流程完成後，這個選項才會開放。</p>
              </div>
            </section>
          </div>

          <div className='col-span-12 space-y-8 lg:col-span-4'>
            <section className='relative overflow-hidden rounded-xl bg-[#273140] p-8 text-white'>
              <div className='mb-8 flex items-center gap-3'>
                <span className='text-[#00d084]'>✦</span>
                <h2 className='text-xl font-bold'>智慧功能 (AI Companion)</h2>
              </div>
              <div className='space-y-6'>
                <label className='flex items-start gap-4'>
                  <input defaultChecked type='checkbox' />
                  <div>
                    <p className='text-sm font-bold'>自動會議摘要</p>
                    <p className='text-xs text-slate-300'>會議結束後自動產出結構化重點摘要與待辦事項。</p>
                  </div>
                </label>
                <label className='flex items-start gap-4'>
                  <input defaultChecked type='checkbox' />
                  <div>
                    <p className='text-sm font-bold'>智慧 Q&A 解析</p>
                    <p className='text-xs text-slate-300'>即時分析學生提問並協助整理課堂討論脈絡。</p>
                  </div>
                </label>
                <label className='flex items-start gap-4'>
                  <input type='checkbox' />
                  <div>
                    <p className='text-sm font-bold'>即時翻譯與字幕</p>
                    <p className='text-xs text-slate-300'>支援超過 30 種語言，提升跨國學生學習成效。</p>
                  </div>
                </label>
              </div>
            </section>

            <section className='rounded-xl bg-white p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.04)]'>
              <div className='mb-8 flex items-center gap-3'>
                <span className='text-[#006d43]'>🎥</span>
                <h2 className='text-xl font-bold'>視訊與音訊</h2>
              </div>
              <div className='space-y-6'>
                <div>
                  <label className='mb-2 block text-sm font-semibold'>主持人視訊</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='off' name='hostVideo'>
                    <option value='on'>開啟</option>
                    <option value='off'>關閉</option>
                  </select>
                </div>
                <div>
                  <label className='mb-2 block text-sm font-semibold'>參與者視訊</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='off' name='participantVideo'>
                    <option value='on'>開啟</option>
                    <option value='off'>關閉</option>
                  </select>
                </div>
                <div>
                  <label className='mb-2 block text-sm font-semibold'>音訊來源</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='voip' name='audio'>
                    <option value='voip'>電腦音訊</option>
                    <option value='telephony'>電話音訊</option>
                    <option value='both'>同時使用</option>
                  </select>
                </div>
                <label className='flex items-center justify-between rounded-lg bg-[#f0f3ff] p-3'>
                  <span className='text-sm font-semibold'>允許主持人前加入</span>
                  <input name='joinBeforeHost' type='checkbox' />
                </label>
                <label className='flex items-center justify-between rounded-lg bg-[#f0f3ff] p-3'>
                  <span className='text-sm font-semibold'>入會即靜音</span>
                  <input defaultChecked name='muteUponEntry' type='checkbox' />
                </label>
                <div>
                  <label className='mb-2 block text-sm font-semibold'>自動錄影</label>
                  <select className='w-full rounded-lg bg-[#f0f3ff] px-4 py-3' defaultValue='none' name='autoRecording'>
                    <option value='none'>不錄影</option>
                    <option value='local'>本機錄影</option>
                    <option value='cloud'>雲端錄影</option>
                  </select>
                </div>
              </div>
            </section>

            <div className='rounded-xl border border-[#006d43]/10 bg-[#b1edc6]/30 p-6'>
              <h4 className='mb-2 text-sm font-bold'>需要排程協助？</h4>
              <p className='mb-4 text-xs text-[#6c7b6f]'>如果您有多個平行課程，建議使用課程模板來快速套用設定。</p>
              <a className='text-xs font-bold text-[#006d43] hover:underline' href='#'>
                查看教學文檔
              </a>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

