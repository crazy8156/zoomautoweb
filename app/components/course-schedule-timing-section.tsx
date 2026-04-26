'use client';

import { useMemo, useState } from 'react';

type ScheduleGroupConfig = {
  index: number;
  label: string;
  checked: boolean;
  startClock: string;
  duration: string;
  endTimes: string;
  weeklyDays: string[];
};

type CourseScheduleTimingSectionProps = {
  defaultMeetingDate: string;
};

const weekdayOptions = [
  ['1', '\u4e00'],
  ['2', '\u4e8c'],
  ['3', '\u4e09'],
  ['4', '\u56db'],
  ['5', '\u4e94'],
  ['6', '\u516d'],
  ['7', '\u65e5'],
] as const;

const defaultGroups: ScheduleGroupConfig[] = [
  { index: 1, label: '\u5e73\u65e5\u6642\u6bb5 A', checked: true, startClock: '10:00', duration: '60', endTimes: '12', weeklyDays: ['1', '3', '5'] },
  { index: 2, label: '\u5e73\u65e5\u6642\u6bb5 B', checked: false, startClock: '13:00', duration: '60', endTimes: '12', weeklyDays: ['2', '4', '6'] },
  { index: 3, label: '\u52a0\u958b\u6642\u6bb5', checked: false, startClock: '19:00', duration: '60', endTimes: '8', weeklyDays: [] },
];

function parseMeetingDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toZoomWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function formatPreviewDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekdayText = '\u65e5\u4e00\u4e8c\u4e09\u56db\u4e94\u516d'[date.getDay()];
  return `${month}/${day}\uff08${weekdayText}\uff09`;
}

function getOccurrences(meetingDate: string, weeklyDays: string[], endTimes: string, repeatInterval: number) {
  const start = parseMeetingDate(meetingDate);
  const totalSessions = Number(endTimes);

  if (!start || weeklyDays.length === 0 || !Number.isFinite(totalSessions) || totalSessions <= 0 || repeatInterval <= 0) {
    return [];
  }

  const selectedDays = new Set(weeklyDays.map((value) => Number(value)));
  const firstOccurrenceOffset = Array.from({ length: 7 }, (_, offset) => offset).find((offset) => {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    return selectedDays.has(toZoomWeekday(candidate));
  });
  const occurrences: Date[] = [];
  const firstOccurrence = new Date(start);
  firstOccurrence.setDate(start.getDate() + (firstOccurrenceOffset ?? 0));

  for (let offset = 0; offset < 366 * 3 && occurrences.length < totalSessions; offset += 1) {
    const current = new Date(firstOccurrence);
    current.setDate(firstOccurrence.getDate() + offset);

    const diffDays = Math.floor((current.getTime() - firstOccurrence.getTime()) / (1000 * 60 * 60 * 24));
    const weekOffset = Math.floor(diffDays / 7);
    if (selectedDays.has(toZoomWeekday(current)) && weekOffset % repeatInterval === 0) {
      occurrences.push(current);
    }
  }

  return occurrences;
}

export function CourseScheduleTimingSection({ defaultMeetingDate }: CourseScheduleTimingSectionProps) {
  const [meetingDate, setMeetingDate] = useState(defaultMeetingDate);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [groups, setGroups] = useState(defaultGroups);

  const previews = useMemo(
    () =>
      groups.map((group) => ({
        index: group.index,
        dates: getOccurrences(meetingDate, group.weeklyDays, group.endTimes, repeatInterval),
      })),
    [groups, meetingDate, repeatInterval],
  );

  function updateGroup(index: number, updater: (group: ScheduleGroupConfig) => ScheduleGroupConfig) {
    setGroups((current) => current.map((group) => (group.index === index ? updater(group) : group)));
  }

  return (
    <section className='rounded-xl bg-white p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.04)]'>
      <div className='mb-8 flex items-center gap-3'>
        <span className='text-[#006d43]'>🕒</span>
        <h2 className='text-xl font-bold'>時間與週期</h2>
      </div>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div>
          <label className='mb-2 block text-xs font-bold uppercase tracking-widest text-[#6c7b6f]'>日期</label>
          <input
            className='w-full rounded-lg bg-[#f0f3ff] px-4 py-4'
            defaultValue={defaultMeetingDate}
            name='meetingDate'
            onChange={(event) => setMeetingDate(event.target.value)}
            type='date'
          />
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
          <input checked={isRecurring} className='h-5 w-5' name='isRecurring' onChange={(event) => setIsRecurring(event.target.checked)} type='checkbox' />
        </div>
        <p className='text-sm text-[#6c7b6f]'>開啟後，可同一門課建立多組每週時段，例如一三五 10:00 與 二四六 13:00。</p>
        {isRecurring ? (
          <>
            <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
              <label className='text-sm font-semibold'>
                每幾週重複一次
                <input
                  className='mt-2 w-full rounded-lg bg-[#f0f3ff] px-4 py-3'
                  defaultValue='1'
                  min='1'
                  name='repeatInterval'
                  onChange={(event) => setRepeatInterval(Math.max(1, Number(event.target.value) || 1))}
                  type='number'
                />
              </label>
              <div className='rounded-lg bg-[#f0f3ff] px-4 py-3 text-sm text-[#6c7b6f]'>
                選開始日期、星期和共幾堂後，下面會立刻列出實際上課日期，方便你先檢查排程有沒有錯。
              </div>
            </div>
            <div className='mt-5 space-y-4'>
              {groups.map((group) => {
                const preview = previews.find((item) => item.index === group.index)?.dates ?? [];

                return (
                  <div key={group.index} className='rounded-xl border border-[#bacbbd]/30 bg-[#f8fbff] p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <label className='flex items-center gap-2 text-sm font-semibold'>
                    <input
                      checked={group.checked}
                      name={`recurringGroup${group.index}Enabled`}
                      onChange={(event) => updateGroup(group.index, (current) => ({ ...current, checked: event.target.checked }))}
                      type='checkbox'
                    />
                    啟用 {group.label}
                  </label>
                  <input
                    className='rounded-lg bg-white px-3 py-2 text-sm'
                    defaultValue={group.label}
                    name={`recurringGroup${group.index}Label`}
                    onChange={(event) => updateGroup(group.index, (current) => ({ ...current, label: event.target.value }))}
                    placeholder='例如：週一三五上午班'
                  />
                </div>
                <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-3'>
                  <label className='text-sm font-semibold'>
                    開始時間
                    <input
                      className='mt-2 w-full rounded-lg bg-white px-4 py-3'
                      defaultValue={group.startClock}
                      name={`recurringGroup${group.index}StartClock`}
                      onChange={(event) => updateGroup(group.index, (current) => ({ ...current, startClock: event.target.value }))}
                      type='time'
                    />
                  </label>
                  <label className='text-sm font-semibold'>
                    單次時長
                    <select
                      className='mt-2 w-full rounded-lg bg-white px-4 py-3'
                      defaultValue={group.duration}
                      name={`recurringGroup${group.index}DurationMinutes`}
                      onChange={(event) => updateGroup(group.index, (current) => ({ ...current, duration: event.target.value }))}
                    >
                      <option value='45'>45 分鐘</option>
                      <option value='60'>60 分鐘</option>
                      <option value='90'>90 分鐘</option>
                      <option value='120'>120 分鐘</option>
                    </select>
                  </label>
                  <label className='text-sm font-semibold'>
                    共幾堂
                    <input
                      className='mt-2 w-full rounded-lg bg-white px-4 py-3'
                      defaultValue={group.endTimes}
                      min='1'
                      name={`recurringGroup${group.index}EndTimes`}
                      onChange={(event) => updateGroup(group.index, (current) => ({ ...current, endTimes: event.target.value }))}
                      type='number'
                    />
                  </label>
                </div>
                <div className='mt-4 flex flex-wrap gap-3 text-sm'>
                  {weekdayOptions.map(([value, label]) => (
                    <label key={`${group.index}-${value}`} className='flex items-center gap-1'>
                      <input
                        checked={group.weeklyDays.includes(value)}
                        name={`recurringGroup${group.index}WeeklyDays`}
                        onChange={(event) =>
                          updateGroup(group.index, (current) => ({
                            ...current,
                            weeklyDays: event.target.checked
                              ? [...current.weeklyDays, value].sort()
                              : current.weeklyDays.filter((item) => item !== value),
                          }))
                        }
                        type='checkbox'
                        value={value}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className='mt-4 rounded-lg border border-[#d7e5df] bg-white px-4 py-3'>
                  <p className='text-sm font-semibold text-[#121c2b]'>預計上課日期</p>
                  {!group.checked ? (
                    <p className='mt-2 text-sm text-[#6c7b6f]'>啟用這組時段後，系統才會建立日期清單。</p>
                  ) : preview.length === 0 ? (
                    <p className='mt-2 text-sm text-[#6c7b6f]'>請先選開始日期、星期和共幾堂，系統就會自動列出日期。</p>
                  ) : (
                    <div className='mt-3 flex flex-wrap gap-2'>
                      {preview.map((date, index) => (
                        <span key={`${group.index}-${index}-${date.toISOString()}`} className='rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#0c7a43]'>
                          {formatPreviewDate(date)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
