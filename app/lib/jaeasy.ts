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
    eyebrow: '單字學習',
    title: '依 JLPT 分級累積字彙',
    text: '從 N5 到 N1 建立清楚的單字庫，搭配例句、讀音與中文解釋，讓複習更有方向。',
  },
  {
    eyebrow: '測驗練習',
    title: '用題目反覆強化記憶',
    text: '透過單字、文法、閱讀三種模式，快速檢查理解程度並累積答題手感。',
  },
  {
    eyebrow: '學習記錄',
    title: '把進度留下來',
    text: '每次作答與複習都會記錄，方便你回頭看自己的成長與弱點。',
  },
] as const;

export const jlptTracks = [
  {
    level: 'N5' as JlptLevel,
    focus: '入門基礎',
    summary: '適合剛開始接觸日文的學生，先建立最常見的生活單字與基本句型。',
  },
  {
    level: 'N4' as JlptLevel,
    focus: '日常應用',
    summary: '逐步擴充日常會話、閱讀短文與聽力理解所需的核心字彙。',
  },
  {
    level: 'N3' as JlptLevel,
    focus: '中階整合',
    summary: '開始處理較長句子與段落，練習文法轉換與閱讀理解能力。',
  },
  {
    level: 'N2' as JlptLevel,
    focus: '進階理解',
    summary: '朝工作、新聞與正式文章的理解前進，提升語感與速度。',
  },
  {
    level: 'N1' as JlptLevel,
    focus: '高階精讀',
    summary: '強化抽象語意、長篇閱讀與高密度表達的掌握能力。',
  },
] as const;

export const quizModes = [
  {
    eyebrow: '測驗模式',
    title: '單字題',
    text: '適合檢查字義、讀音與例句理解，快速建立基礎記憶。',
  },
  {
    eyebrow: '測驗模式',
    title: '文法題',
    text: '透過句型與語境判斷，訓練實際使用時的文法敏感度。',
  },
  {
    eyebrow: '測驗模式',
    title: '閱讀題',
    text: '用段落與短文做理解練習，提升整體閱讀速度與準確度。',
  },
] as const;

export const jaeasyApiModules = [
  {
    title: '帳號模組',
    text: '處理註冊、登入、密碼重設與會員身份辨識。',
  },
  {
    title: '單字模組',
    text: '管理 JLPT 分級字彙、例句與單字資料同步。',
  },
  {
    title: '測驗模組',
    text: '產生題目、記錄作答與彙整各種測驗結果。',
  },
  {
    title: '複習模組',
    text: '使用 SRS 方式安排下次複習時間，讓記憶更穩定。',
  },
] as const;

export const sampleVocabulary = [
  { word: '勉強', reading: 'べんきょう', meaning: '學習、用功', level: 'N5' as JlptLevel },
  { word: '経験', reading: 'けいけん', meaning: '經驗', level: 'N4' as JlptLevel },
  { word: '改善', reading: 'かいぜん', meaning: '改善', level: 'N3' as JlptLevel },
  { word: '観察', reading: 'かんさつ', meaning: '觀察', level: 'N2' as JlptLevel },
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
      word: '経験',
      reading: 'けいけん',
      meaning: '經驗',
      level: 'N4',
      grade: 4,
      repetitions: 1,
      easeFactor: 2.4,
      intervalDays: 1,
    },
    {
      word: '改善',
      reading: 'かいぜん',
      meaning: '改善',
      level: 'N3',
      grade: 3,
      repetitions: 2,
      easeFactor: 2.3,
      intervalDays: 6,
    },
    {
      word: '観察',
      reading: 'かんさつ',
      meaning: '觀察',
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
