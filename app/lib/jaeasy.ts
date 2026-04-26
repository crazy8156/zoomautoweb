export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type QuizMode = 'vocab' | 'grammar' | 'reading';

export type ReviewPreview = {
  word: string;
  reading: string;
  meaning: string;
  level: JlptLevel;
  grade: number;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
};

export const jaeasyTracks = [
  {
    eyebrow: 'Vocabulary',
    title: '單字複習',
    text: '把 JLPT 單字整理成可反覆複習的節奏，適合搭配直播課後延續記憶與回顧。',
  },
  {
    eyebrow: 'Quiz',
    title: '題庫練習',
    text: '保留單字、文法、閱讀三種測驗模式，讓學習不只停留在課堂理解。',
  },
  {
    eyebrow: 'API',
    title: '後端模組',
    text: 'jaeasy 的 FastAPI、資料模型與認證邏輯已併入主資料夾，方便後續再串主站。',
  },
] as const;

export const jlptTracks = [
  {
    level: 'N5' as JlptLevel,
    focus: '基礎入門',
    summary: '從日常生活單字、簡單句型與入門題型開始，適合剛進入日文學習的學生。',
  },
  {
    level: 'N4' as JlptLevel,
    focus: '穩定累積',
    summary: '逐步拉高單字量與閱讀耐力，適合已經有基礎、需要穩定複習節奏的學習者。',
  },
  {
    level: 'N3' as JlptLevel,
    focus: '中階進入',
    summary: '開始把閱讀、文法與單字量結合起來，讓題目練習不只停在片段記憶。',
  },
  {
    level: 'N2' as JlptLevel,
    focus: '強化應試',
    summary: '加重閱讀與文法應用，適合需要系統整理題型與錯題複盤的學生。',
  },
  {
    level: 'N1' as JlptLevel,
    focus: '高階挑戰',
    summary: '面向高階詞彙、長篇閱讀與精準辨析，適合作為進階自學專區的上層入口。',
  },
] as const;

export const quizModes = [
  {
    eyebrow: 'Quiz Mode',
    title: '單字測驗',
    text: '適合快速檢查記憶熟悉度，配合複習排程可做短週期反覆練習。',
  },
  {
    eyebrow: 'Quiz Mode',
    title: '文法測驗',
    text: '用句型與選項題檢查理解，不讓文法只停留在看過規則卻沒有真正使用。',
  },
  {
    eyebrow: 'Quiz Mode',
    title: '閱讀測驗',
    text: '把理解與速度一起拉上來，適合作為直播課後延伸閱讀與應試節奏的補強。',
  },
] as const;

export const jaeasyApiModules = [
  {
    title: 'Auth API',
    text: 'register / login token 流程與密碼雜湊邏輯，原本由 FastAPI + JWT 提供。',
  },
  {
    title: 'Vocabulary API',
    text: '按 JLPT 等級列出單字、今日複習清單與評分後的複習更新邏輯。',
  },
  {
    title: 'Quiz API',
    text: '依照等級與題型抽題，回傳作答結果與統計數據，適合後續接進站內互動頁。',
  },
  {
    title: 'SRS Service',
    text: 'SM-2 複習演算法已轉成主站共用模組，後續可直接接資料表或學習紀錄。',
  },
] as const;

export const sampleVocabulary = [
  { word: '勉強', reading: 'べんきょう', meaning: '學習、用功', level: 'N5' as JlptLevel },
  { word: '理由', reading: 'りゆう', meaning: '理由、原因', level: 'N4' as JlptLevel },
  { word: '改善', reading: 'かいぜん', meaning: '改善、改進', level: 'N3' as JlptLevel },
  { word: '把握', reading: 'はあく', meaning: '掌握、理解', level: 'N2' as JlptLevel },
] as const;

export function calculateNextReview(
  grade: number,
  repetitions: number,
  easeFactor: number,
  intervalDays: number,
) {
  let nextRepetitions = repetitions;
  let nextIntervalDays = intervalDays;

  if (grade < 3) {
    nextRepetitions = 0;
    nextIntervalDays = 1;
  } else {
    if (repetitions === 0) {
      nextIntervalDays = 1;
    } else if (repetitions === 1) {
      nextIntervalDays = 6;
    } else {
      nextIntervalDays = Math.round(intervalDays * easeFactor * 10) / 10;
    }
    nextRepetitions += 1;
  }

  const nextEaseFactor = Math.max(
    1.3,
    Math.round((easeFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)) * 1000) / 1000,
  );

  const nextReviewAt = new Date(Date.now() + nextIntervalDays * 24 * 60 * 60 * 1000);

  return {
    intervalDays: nextIntervalDays,
    easeFactor: nextEaseFactor,
    repetitions: nextRepetitions,
    nextReviewAt,
  };
}

export function buildSampleReviewQueue() {
  const seeds: ReviewPreview[] = [
    {
      word: '勉強',
      reading: 'べんきょう',
      meaning: '學習、用功',
      level: 'N5',
      grade: 5,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
    },
    {
      word: '理由',
      reading: 'りゆう',
      meaning: '理由、原因',
      level: 'N4',
      grade: 4,
      repetitions: 1,
      easeFactor: 2.4,
      intervalDays: 1,
    },
    {
      word: '改善',
      reading: 'かいぜん',
      meaning: '改善、改進',
      level: 'N3',
      grade: 3,
      repetitions: 2,
      easeFactor: 2.3,
      intervalDays: 6,
    },
    {
      word: '把握',
      reading: 'はあく',
      meaning: '掌握、理解',
      level: 'N2',
      grade: 2,
      repetitions: 3,
      easeFactor: 2.2,
      intervalDays: 12,
    },
  ];

  return seeds.map((seed) => {
    const next = calculateNextReview(seed.grade, seed.repetitions, seed.easeFactor, seed.intervalDays);

    return {
      word: seed.word,
      reading: seed.reading,
      meaning: seed.meaning,
      level: seed.level,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor.toFixed(2),
      nextReviewLabel: new Intl.DateTimeFormat('zh-TW', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Taipei',
      }).format(next.nextReviewAt),
    };
  });
}
