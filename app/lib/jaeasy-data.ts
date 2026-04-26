import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase-admin';
import { calculateNextReview, type JlptLevel, type QuizMode } from './jaeasy';

export type JaeasyVocabularyItem = {
  id: number;
  word: string;
  reading: string;
  meaningZh: string;
  pos: string;
  jlptLevel: JlptLevel;
  exampleJa: string;
  exampleZh: string;
  audioUrl: string | null;
};

export type JaeasyQuizQuestion = {
  id: string;
  type: QuizMode;
  jlptLevel: JlptLevel;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string | null;
};

export type JaeasyReviewItem = {
  vocab: JaeasyVocabularyItem;
  srs: {
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
    lastGrade: number;
    nextReviewAt: string;
    status: 'new' | 'due' | 'scheduled';
  };
};

export type JaeasyQuizAttemptSummary = {
  questionId: string;
  question: string;
  selectedIndex: number;
  selectedLabel: string | null;
  correctIndex: number;
  correctLabel: string;
  isCorrect: boolean;
};

export type JaeasyQuizSubmissionResult = {
  correctCount: number;
  totalCount: number;
  attempts: JaeasyQuizAttemptSummary[];
};

export type JaeasyMemberMetrics = {
  trackedVocabulary: number;
  dueReviews: number;
  upcomingReviews: number;
  masteredVocabulary: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  lastAnsweredAt: string | null;
};

export type JaeasyContentSummary = {
  vocabularyCount: number;
  generatedVocabQuestionCount: number;
  manualQuestionCount: number;
  grammarQuestionCount: number;
  readingQuestionCount: number;
  totalAttemptCount: number;
};

type VocabularyRow = {
  id: number;
  word: string;
  reading: string;
  meaning_zh: string;
  pos: string;
  jlpt_level: JlptLevel;
  audio_url: string | null;
  example_ja: string;
  example_zh: string;
};

type QuizQuestionRow = {
  id: string;
  type: QuizMode;
  jlpt_level: JlptLevel;
  question: string;
  options: unknown;
  answer_index: number;
  explanation: string | null;
};

type SrsRow = {
  id: string;
  user_id: string;
  vocab_id: number;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  last_grade: number;
  next_review_at: string;
  created_at: string;
  updated_at: string;
};

type QuizAttemptRow = {
  id: string;
  user_id: string;
  question_id: string;
  quiz_type: QuizMode;
  jlpt_level: JlptLevel;
  question_snapshot: string;
  selected_index: number;
  selected_label: string | null;
  correct_index: number;
  correct_label: string;
  is_correct: boolean;
  answered_at: string;
};

const jlptOrder: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

function compareLevel(left: JlptLevel, right: JlptLevel) {
  return jlptOrder.indexOf(left) - jlptOrder.indexOf(right);
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function toVocabularyItem(row: VocabularyRow): JaeasyVocabularyItem {
  return {
    id: row.id,
    word: row.word,
    reading: row.reading,
    meaningZh: row.meaning_zh,
    pos: row.pos,
    jlptLevel: row.jlpt_level,
    exampleJa: row.example_ja,
    exampleZh: row.example_zh,
    audioUrl: row.audio_url,
  };
}

function toQuizQuestion(row: QuizQuestionRow): JaeasyQuizQuestion {
  return {
    id: row.id,
    type: row.type,
    jlptLevel: row.jlpt_level,
    question: row.question,
    options: normalizeOptions(row.options),
    answerIndex: row.answer_index,
    explanation: row.explanation,
  };
}

function toQuizQuestionRow(question: JaeasyQuizQuestion): Omit<QuizQuestionRow, 'options'> & { options: string[] } {
  return {
    id: question.id,
    type: question.type,
    jlpt_level: question.jlptLevel,
    question: question.question,
    options: question.options,
    answer_index: question.answerIndex,
    explanation: question.explanation,
  };
}

function uniqueBy<T>(items: T[], selector: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function shuffleList<T>(items: T[]) {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function isTodayInTaipei(value: string) {
  const target = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return target === today;
}

function buildVocabQuestion(item: JaeasyVocabularyItem, vocabulary: JaeasyVocabularyItem[]): JaeasyQuizQuestion {
  const sameLevelPool = vocabulary.filter((candidate) => candidate.jlptLevel === item.jlptLevel && candidate.id !== item.id);
  const crossLevelPool = vocabulary.filter((candidate) => candidate.id !== item.id && candidate.jlptLevel !== item.jlptLevel);
  const distractorPool = uniqueBy([...sameLevelPool, ...crossLevelPool], (candidate) => candidate.meaningZh);

  const distractors = distractorPool
    .map((candidate) => ({
      candidate,
      rank: Math.abs(candidate.id - item.id) + (candidate.jlptLevel === item.jlptLevel ? 0 : 1000),
    }))
    .sort((left, right) => left.rank - right.rank || left.candidate.id - right.candidate.id)
    .slice(0, 3)
    .map((entry) => entry.candidate.meaningZh);

  const correctOption = item.meaningZh;
  const optionPool = uniqueBy([correctOption, ...distractors], (value) => value);

  while (optionPool.length < 4) {
    optionPool.push(`未設定選項 ${optionPool.length + 1}`);
  }

  const rotation = item.id % optionPool.length;
  const options = optionPool.slice(rotation).concat(optionPool.slice(0, rotation));
  const answerIndex = options.indexOf(correctOption);

  return {
    id: `vocab-${item.id}`,
    type: 'vocab',
    jlptLevel: item.jlptLevel,
    question: `${item.word}（${item.reading}）的中文意思是？`,
    options,
    answerIndex: answerIndex < 0 ? 0 : answerIndex,
    explanation: item.exampleZh || null,
  };
}

function buildGeneratedVocabQuestions(vocabulary: JaeasyVocabularyItem[]) {
  return vocabulary
    .slice()
    .sort((left, right) => compareLevel(left.jlptLevel, right.jlptLevel) || left.id - right.id)
    .map((item) => buildVocabQuestion(item, vocabulary));
}

async function listVocabularyRows(level?: JlptLevel) {
  let query = supabaseAdmin
    .from('jaeasy_vocabulary')
    .select('id,word,reading,meaning_zh,pos,jlpt_level,audio_url,example_ja,example_zh')
    .order('id', { ascending: true });

  if (level) {
    query = query.eq('jlpt_level', level);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`讀取 Jaeasy 字庫失敗：${error.message}`);
  }

  return (data ?? []) as VocabularyRow[];
}

async function listQuestionRows(types?: QuizMode[]) {
  let query = supabaseAdmin
    .from('jaeasy_quiz_questions')
    .select('id,type,jlpt_level,question,options,answer_index,explanation')
    .order('id', { ascending: true });

  if (types && types.length > 0) {
    query = query.in('type', types);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`讀取 Jaeasy 題庫失敗：${error.message}`);
  }

  return (data ?? []) as QuizQuestionRow[];
}

async function listSrsRowsForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('jaeasy_user_vocab_srs')
    .select('id,user_id,vocab_id,interval_days,ease_factor,repetitions,last_grade,next_review_at,created_at,updated_at')
    .eq('user_id', userId)
    .order('next_review_at', { ascending: true });

  if (error) {
    throw new Error(`讀取複習進度失敗：${error.message}`);
  }

  return (data ?? []) as SrsRow[];
}

async function syncGeneratedVocabQuestions(vocabulary?: JaeasyVocabularyItem[]) {
  const catalog = vocabulary ?? (await getVocabularyCatalog());
  const generated = buildGeneratedVocabQuestions(catalog);
  const generatedIds = new Set(generated.map((item) => item.id));

  const existingRows = await listQuestionRows(['vocab']);
  const staleIds = existingRows.map((item) => item.id).filter((id) => !generatedIds.has(id));

  if (generated.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('jaeasy_quiz_questions')
      .upsert(generated.map(toQuizQuestionRow), { onConflict: 'id' });

    if (upsertError) {
      throw new Error(`同步單字自動題失敗：${upsertError.message}`);
    }
  }

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin.from('jaeasy_quiz_questions').delete().in('id', staleIds);

    if (deleteError) {
      throw new Error(`清除舊單字自動題失敗：${deleteError.message}`);
    }
  }

  return generated;
}

function buildMetricsFromRows(srsRows: SrsRow[], attemptRows: QuizAttemptRow[]): JaeasyMemberMetrics {
  const now = Date.now();
  const trackedVocabulary = srsRows.length;
  const dueReviews = srsRows.filter((row) => new Date(row.next_review_at).getTime() <= now).length;
  const upcomingReviews = srsRows.filter((row) => new Date(row.next_review_at).getTime() > now).length;
  const masteredVocabulary = srsRows.filter((row) => row.repetitions >= 3 && row.last_grade >= 4).length;
  const totalAttempts = attemptRows.length;
  const correctAttempts = attemptRows.filter((row) => row.is_correct).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const lastAnsweredAt = attemptRows[0]?.answered_at ?? null;

  return {
    trackedVocabulary,
    dueReviews,
    upcomingReviews,
    masteredVocabulary,
    totalAttempts,
    correctAttempts,
    accuracy,
    lastAnsweredAt,
  };
}

export async function getVocabularyCatalog(level?: JlptLevel) {
  const rows = await listVocabularyRows(level);
  return rows.map(toVocabularyItem);
}

export async function getManualQuizQuestions() {
  const rows = await listQuestionRows(['grammar', 'reading']);
  return rows.map(toQuizQuestion);
}

export async function getGeneratedVocabQuestions() {
  const vocabulary = await getVocabularyCatalog();
  return buildGeneratedVocabQuestions(vocabulary);
}

export async function getUserDueReviewItems(userId: string, limit = 6): Promise<JaeasyReviewItem[]> {
  const [vocabulary, srsRows] = await Promise.all([getVocabularyCatalog(), listSrsRowsForUser(userId)]);
  const vocabMap = new Map(vocabulary.map((item) => [item.id, item]));
  const trackedIds = new Set(srsRows.map((row) => row.vocab_id));
  const now = Date.now();

  const dueItems = srsRows
    .filter((row) => new Date(row.next_review_at).getTime() <= now)
    .map((row) => {
      const vocab = vocabMap.get(row.vocab_id);
      if (!vocab) return null;

      return {
        vocab,
        srs: {
          intervalDays: row.interval_days,
          easeFactor: row.ease_factor,
          repetitions: row.repetitions,
          lastGrade: row.last_grade,
          nextReviewAt: row.next_review_at,
          status: 'due' as const,
        },
      };
    })
    .filter(isDefined);

  const newItems = vocabulary
    .filter((item) => !trackedIds.has(item.id))
    .sort((left, right) => compareLevel(left.jlptLevel, right.jlptLevel) || left.id - right.id)
    .slice(0, Math.max(limit - dueItems.length, 0))
    .map((vocab) => ({
      vocab,
      srs: {
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lastGrade: 0,
        nextReviewAt: new Date().toISOString(),
        status: 'new' as const,
      },
    }));

  return [...dueItems, ...newItems].slice(0, limit);
}

export async function getUpcomingReviewItems(userId: string, limit = 4): Promise<JaeasyReviewItem[]> {
  const [vocabulary, srsRows] = await Promise.all([getVocabularyCatalog(), listSrsRowsForUser(userId)]);
  const vocabMap = new Map(vocabulary.map((item) => [item.id, item]));
  const now = Date.now();

  return srsRows
    .filter((row) => new Date(row.next_review_at).getTime() > now)
    .map((row) => {
      const vocab = vocabMap.get(row.vocab_id);
      if (!vocab) return null;

      return {
        vocab,
        srs: {
          intervalDays: row.interval_days,
          easeFactor: row.ease_factor,
          repetitions: row.repetitions,
          lastGrade: row.last_grade,
          nextReviewAt: row.next_review_at,
          status: 'scheduled' as const,
        },
      };
    })
    .filter(isDefined)
    .slice(0, limit);
}

export async function gradeReviewItem(userId: string, vocabId: number, grade: number) {
  const nextGrade = Math.max(0, Math.min(5, Math.round(grade)));
  const { data, error } = await supabaseAdmin
    .from('jaeasy_user_vocab_srs')
    .select('id,user_id,vocab_id,interval_days,ease_factor,repetitions,last_grade,next_review_at,created_at,updated_at')
    .eq('user_id', userId)
    .eq('vocab_id', vocabId)
    .maybeSingle();

  if (error) {
    throw new Error(`讀取複習項目失敗：${error.message}`);
  }

  const current = data as SrsRow | null;
  const next = calculateNextReview(
    nextGrade,
    current?.repetitions ?? 0,
    current?.ease_factor ?? 2.5,
    current?.interval_days ?? 0,
  );

  const { error: upsertError } = await supabaseAdmin.from('jaeasy_user_vocab_srs').upsert(
    {
      id: current?.id ?? randomUUID(),
      user_id: userId,
      vocab_id: vocabId,
      interval_days: next.intervalDays,
      ease_factor: next.easeFactor,
      repetitions: next.repetitions,
      last_grade: nextGrade,
      next_review_at: next.nextReviewAt.toISOString(),
    },
    { onConflict: 'user_id,vocab_id' },
  );

  if (upsertError) {
    throw new Error(`儲存複習進度失敗：${upsertError.message}`);
  }
}

export async function getUserQuizQuestionSet(level: JlptLevel, type: QuizMode, count = 5) {
  if (type === 'vocab') {
    await syncGeneratedVocabQuestions();
  }

  const { data, error } = await supabaseAdmin
    .from('jaeasy_quiz_questions')
    .select('id,type,jlpt_level,question,options,answer_index,explanation')
    .eq('jlpt_level', level)
    .eq('type', type);

  if (error) {
    throw new Error(`讀取測驗題目失敗：${error.message}`);
  }

  return shuffleList(((data ?? []) as QuizQuestionRow[]).map(toQuizQuestion)).slice(0, count);
}

export async function getQuestionsByIds(questionIds: string[]) {
  if (questionIds.length === 0) return [];

  const fetchQuestions = async () => {
    const { data, error } = await supabaseAdmin
      .from('jaeasy_quiz_questions')
      .select('id,type,jlpt_level,question,options,answer_index,explanation')
      .in('id', questionIds);

    if (error) {
      throw new Error(`讀取題目失敗：${error.message}`);
    }

    const rowMap = new Map(((data ?? []) as QuizQuestionRow[]).map((row) => [row.id, toQuizQuestion(row)]));
    return questionIds.map((id) => rowMap.get(id)).filter((item): item is JaeasyQuizQuestion => Boolean(item));
  };

  let questions = await fetchQuestions();

  if (questions.length !== questionIds.length && questionIds.some((id) => id.startsWith('vocab-'))) {
    await syncGeneratedVocabQuestions();
    questions = await fetchQuestions();
  }

  return questions;
}

export async function submitQuizAnswers(
  userId: string,
  answers: { questionId: string; selectedIndex: number }[],
): Promise<JaeasyQuizSubmissionResult> {
  const questions = await getQuestionsByIds(answers.map((item) => item.questionId));
  const questionMap = new Map(questions.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  const attempts = answers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      throw new Error(`找不到題目：${answer.questionId}`);
    }

    const selectedLabel = question.options[answer.selectedIndex] ?? null;
    const correctLabel = question.options[question.answerIndex] ?? '';

    return {
      questionId: question.id,
      question: question.question,
      selectedIndex: answer.selectedIndex,
      selectedLabel,
      correctIndex: question.answerIndex,
      correctLabel,
      isCorrect: answer.selectedIndex === question.answerIndex,
      type: question.type,
      jlptLevel: question.jlptLevel,
      answeredAt: now,
    };
  });

  const { error } = await supabaseAdmin.from('jaeasy_quiz_attempts').insert(
    attempts.map((attempt) => ({
      id: randomUUID(),
      user_id: userId,
      question_id: attempt.questionId,
      quiz_type: attempt.type,
      jlpt_level: attempt.jlptLevel,
      question_snapshot: attempt.question,
      selected_index: attempt.selectedIndex,
      selected_label: attempt.selectedLabel,
      correct_index: attempt.correctIndex,
      correct_label: attempt.correctLabel,
      is_correct: attempt.isCorrect,
      answered_at: attempt.answeredAt,
    })),
  );

  if (error) {
    throw new Error(`儲存作答紀錄失敗：${error.message}`);
  }

  return {
    correctCount: attempts.filter((item) => item.isCorrect).length,
    totalCount: attempts.length,
    attempts: attempts.map((attempt) => ({
      questionId: attempt.questionId,
      question: attempt.question,
      selectedIndex: attempt.selectedIndex,
      selectedLabel: attempt.selectedLabel,
      correctIndex: attempt.correctIndex,
      correctLabel: attempt.correctLabel,
      isCorrect: attempt.isCorrect,
    })),
  };
}

export async function getUserQuizStats(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('jaeasy_quiz_attempts')
    .select('is_correct')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`讀取測驗統計失敗：${error.message}`);
  }

  const rows = (data ?? []) as Pick<QuizAttemptRow, 'is_correct'>[];
  const totalAttempts = rows.length;
  const correctCount = rows.filter((row) => row.is_correct).length;

  return {
    totalAttempts,
    correctCount,
    accuracy: totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0,
  };
}

export async function getRecentQuizAttempts(userId: string, limit = 6) {
  const { data, error } = await supabaseAdmin
    .from('jaeasy_quiz_attempts')
    .select('id,question_id,quiz_type,jlpt_level,question_snapshot,selected_index,selected_label,correct_index,correct_label,is_correct,answered_at')
    .eq('user_id', userId)
    .order('answered_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`讀取最近測驗紀錄失敗：${error.message}`);
  }

  return ((data ?? []) as Omit<QuizAttemptRow, 'user_id'>[]).map((row) => ({
    id: row.id,
    questionId: row.question_id,
    type: row.quiz_type,
    jlptLevel: row.jlpt_level,
    question: row.question_snapshot,
    selectedIndex: row.selected_index,
    selectedLabel: row.selected_label,
    correctIndex: row.correct_index,
    correctLabel: row.correct_label,
    isCorrect: row.is_correct,
    answeredAt: row.answered_at,
  }));
}

export async function getGlobalRecentQuizAttempts(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('jaeasy_quiz_attempts')
    .select('id,question_id,user_id,quiz_type,jlpt_level,question_snapshot,selected_index,selected_label,correct_index,correct_label,is_correct,answered_at')
    .order('answered_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`讀取全站測驗紀錄失敗：${error.message}`);
  }

  return ((data ?? []) as QuizAttemptRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    type: row.quiz_type,
    jlptLevel: row.jlpt_level,
    question: row.question_snapshot,
    selectedIndex: row.selected_index,
    selectedLabel: row.selected_label,
    correctIndex: row.correct_index,
    correctLabel: row.correct_label,
    isCorrect: row.is_correct,
    answeredAt: row.answered_at,
  }));
}

export async function getUserLearningSnapshot(userId: string) {
  const [vocabulary, srsRows, quizStats] = await Promise.all([
    getVocabularyCatalog(),
    listSrsRowsForUser(userId),
    getUserQuizStats(userId),
  ]);

  const dueCount = srsRows.filter((row) => new Date(row.next_review_at).getTime() <= Date.now()).length;
  const reviewedToday = srsRows.filter((row) => isTodayInTaipei(row.updated_at)).length;
  const masteredCount = srsRows.filter((row) => row.repetitions >= 3 && row.last_grade >= 4).length;

  return {
    totalVocabulary: vocabulary.length,
    trackedVocabulary: srsRows.length,
    dueCount,
    reviewedToday,
    masteredCount,
    quizStats,
  };
}

export async function getCatalogBreakdown() {
  const vocabulary = await getVocabularyCatalog();
  return jlptOrder.map((level) => ({
    level,
    count: vocabulary.filter((item) => item.jlptLevel === level).length,
  }));
}

export async function getJaeasyContentSummary(): Promise<JaeasyContentSummary> {
  const [{ count: vocabularyCount, error: vocabularyError }, { count: totalAttemptCount, error: attemptsError }, questionRows] =
    await Promise.all([
      supabaseAdmin.from('jaeasy_vocabulary').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('jaeasy_quiz_attempts').select('id', { count: 'exact', head: true }),
      listQuestionRows(),
    ]);

  if (vocabularyError) {
    throw new Error(`讀取字庫統計失敗：${vocabularyError.message}`);
  }

  if (attemptsError) {
    throw new Error(`讀取作答統計失敗：${attemptsError.message}`);
  }

  const generatedVocabQuestionCount = questionRows.filter((item) => item.type === 'vocab').length;
  const grammarQuestionCount = questionRows.filter((item) => item.type === 'grammar').length;
  const readingQuestionCount = questionRows.filter((item) => item.type === 'reading').length;

  return {
    vocabularyCount: vocabularyCount ?? 0,
    generatedVocabQuestionCount,
    manualQuestionCount: grammarQuestionCount + readingQuestionCount,
    grammarQuestionCount,
    readingQuestionCount,
    totalAttemptCount: totalAttemptCount ?? 0,
  };
}

export async function getMemberMetricsMap(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const result = new Map<string, JaeasyMemberMetrics>();

  if (uniqueUserIds.length === 0) {
    return result;
  }

  const [{ data: srsData, error: srsError }, { data: attemptData, error: attemptError }] = await Promise.all([
    supabaseAdmin
      .from('jaeasy_user_vocab_srs')
      .select('id,user_id,vocab_id,interval_days,ease_factor,repetitions,last_grade,next_review_at,created_at,updated_at')
      .in('user_id', uniqueUserIds),
    supabaseAdmin
      .from('jaeasy_quiz_attempts')
      .select('id,user_id,question_id,quiz_type,jlpt_level,question_snapshot,selected_index,selected_label,correct_index,correct_label,is_correct,answered_at')
      .in('user_id', uniqueUserIds)
      .order('answered_at', { ascending: false }),
  ]);

  if (srsError) {
    throw new Error(`讀取會員複習統計失敗：${srsError.message}`);
  }

  if (attemptError) {
    throw new Error(`讀取會員作答統計失敗：${attemptError.message}`);
  }

  for (const userId of uniqueUserIds) {
    const memberSrsRows = ((srsData ?? []) as SrsRow[]).filter((row) => row.user_id === userId);
    const memberAttemptRows = ((attemptData ?? []) as QuizAttemptRow[]).filter((row) => row.user_id === userId);
    result.set(userId, buildMetricsFromRows(memberSrsRows, memberAttemptRows));
  }

  return result;
}

export async function createVocabularyItem(input: Omit<JaeasyVocabularyItem, 'id'>) {
  const { data: maxRow, error: maxError } = await supabaseAdmin
    .from('jaeasy_vocabulary')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    throw new Error(`讀取字庫流水號失敗：${maxError.message}`);
  }

  const nextId = (maxRow?.id ?? 0) + 1;
  const payload: VocabularyRow = {
    id: nextId,
    word: input.word,
    reading: input.reading,
    meaning_zh: input.meaningZh,
    pos: input.pos,
    jlpt_level: input.jlptLevel,
    audio_url: input.audioUrl,
    example_ja: input.exampleJa,
    example_zh: input.exampleZh,
  };

  const { error } = await supabaseAdmin.from('jaeasy_vocabulary').insert(payload);

  if (error) {
    throw new Error(`新增字庫失敗：${error.message}`);
  }

  await syncGeneratedVocabQuestions();

  return nextId;
}

export async function updateVocabularyItem(id: number, input: Omit<JaeasyVocabularyItem, 'id'>) {
  const { error } = await supabaseAdmin
    .from('jaeasy_vocabulary')
    .update({
      word: input.word,
      reading: input.reading,
      meaning_zh: input.meaningZh,
      pos: input.pos,
      jlpt_level: input.jlptLevel,
      audio_url: input.audioUrl,
      example_ja: input.exampleJa,
      example_zh: input.exampleZh,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`更新字庫失敗：${error.message}`);
  }

  await syncGeneratedVocabQuestions();
}

export async function deleteVocabularyItem(id: number) {
  const { error } = await supabaseAdmin.from('jaeasy_vocabulary').delete().eq('id', id);

  if (error) {
    throw new Error(`刪除字庫失敗：${error.message}`);
  }

  await syncGeneratedVocabQuestions();
}

export async function createManualQuizQuestion(input: Omit<JaeasyQuizQuestion, 'id'>) {
  const id = `${input.type}-${input.jlptLevel}-${randomUUID()}`;
  const payload = {
    id,
    type: input.type,
    jlpt_level: input.jlptLevel,
    question: input.question,
    options: input.options,
    answer_index: input.answerIndex,
    explanation: input.explanation,
  };

  const { error } = await supabaseAdmin.from('jaeasy_quiz_questions').insert(payload);

  if (error) {
    throw new Error(`新增題目失敗：${error.message}`);
  }

  return id;
}

export async function updateManualQuizQuestion(id: string, input: Omit<JaeasyQuizQuestion, 'id'>) {
  const { error } = await supabaseAdmin
    .from('jaeasy_quiz_questions')
    .update({
      type: input.type,
      jlpt_level: input.jlptLevel,
      question: input.question,
      options: input.options,
      answer_index: input.answerIndex,
      explanation: input.explanation,
    })
    .eq('id', id)
    .neq('type', 'vocab');

  if (error) {
    throw new Error(`更新題目失敗：${error.message}`);
  }
}

export async function deleteManualQuizQuestion(id: string) {
  const { error } = await supabaseAdmin.from('jaeasy_quiz_questions').delete().eq('id', id).neq('type', 'vocab');

  if (error) {
    throw new Error(`刪除題目失敗：${error.message}`);
  }
}
