import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env.local');
const dataDir = path.join(rootDir, 'data', 'jaeasy');
const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

async function readJson(fileName) {
  const filePath = path.join(dataDir, fileName);
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function uniqueBy(items, selector) {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildVocabQuestion(item, vocabulary) {
  const sameLevelPool = vocabulary.filter((candidate) => candidate.jlptLevel === item.jlptLevel && candidate.id !== item.id);
  const crossLevelPool = vocabulary.filter((candidate) => candidate.id !== item.id && candidate.jlptLevel !== item.jlptLevel);
  const distractorPool = uniqueBy([...sameLevelPool, ...crossLevelPool], (candidate) => candidate.meaningZh);

  const rankedDistractors = distractorPool
    .map((candidate) => ({
      ...candidate,
      rank: Math.abs(candidate.id - item.id) + (candidate.jlptLevel === item.jlptLevel ? 0 : 1000),
    }))
    .sort((left, right) => left.rank - right.rank || left.id - right.id)
    .slice(0, 3);

  const correctOption = item.meaningZh;
  const optionPool = uniqueBy(
    [correctOption, ...rankedDistractors.map((candidate) => candidate.meaningZh)],
    (value) => value,
  );

  while (optionPool.length < 4) {
    optionPool.push(`未設定選項 ${optionPool.length + 1}`);
  }

  const rotation = item.id % optionPool.length;
  const options = optionPool.slice(rotation).concat(optionPool.slice(0, rotation));
  const answerIndex = options.indexOf(correctOption);

  return {
    id: `vocab-${item.id}`,
    type: 'vocab',
    jlpt_level: item.jlptLevel,
    question: `${item.word}（${item.reading}）的中文意思是？`,
    options,
    answer_index: answerIndex < 0 ? 0 : answerIndex,
    explanation: item.exampleZh || null,
  };
}

function buildGeneratedVocabQuestions(vocabulary) {
  return vocabulary
    .slice()
    .sort((left, right) => jlptLevels.indexOf(left.jlptLevel) - jlptLevels.indexOf(right.jlptLevel) || left.id - right.id)
    .map((item) => buildVocabQuestion(item, vocabulary));
}

async function main() {
  const env = parseEnv(await readFile(envPath, 'utf8'));
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const [vocabulary, srsRecords, manualQuizQuestions, quizAttempts] = await Promise.all([
    readJson('vocabulary.json'),
    readJson('user_vocab_srs.json'),
    readJson('quiz_questions.json'),
    readJson('quiz_attempts.json'),
  ]);

  const normalizedVocabulary = vocabulary.map((item) => ({
    id: item.id,
    word: item.word,
    reading: item.reading,
    meaning_zh: item.meaningZh,
    pos: item.pos,
    jlpt_level: item.jlptLevel,
    audio_url: item.audioUrl,
    example_ja: item.exampleJa,
    example_zh: item.exampleZh,
  }));

  const normalizedSrsRecords = srsRecords.map((item) => ({
    id: item.id,
    user_id: item.userId,
    vocab_id: item.vocabId,
    interval_days: item.intervalDays,
    ease_factor: item.easeFactor,
    repetitions: item.repetitions,
    last_grade: item.lastGrade,
    next_review_at: item.nextReviewAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }));

  const generatedVocabQuestions = buildGeneratedVocabQuestions(vocabulary);
  const normalizedQuizQuestions = [
    ...manualQuizQuestions.map((item) => ({
      id: item.id,
      type: item.type,
      jlpt_level: item.jlptLevel,
      question: item.question,
      options: item.options,
      answer_index: item.answerIndex,
      explanation: item.explanation,
    })),
    ...generatedVocabQuestions,
  ];

  const normalizedQuizAttempts = quizAttempts.map((item) => ({
    id: item.id,
    user_id: item.userId,
    question_id: item.questionId,
    quiz_type: item.type,
    jlpt_level: item.jlptLevel,
    question_snapshot: item.question,
    selected_index: item.selectedIndex,
    selected_label: item.selectedLabel,
    correct_index: item.correctIndex,
    correct_label: item.correctLabel,
    is_correct: item.isCorrect,
    answered_at: item.answeredAt,
  }));

  console.log(`Syncing ${normalizedVocabulary.length} vocabulary rows`);
  const vocabResult = await supabase.from('jaeasy_vocabulary').upsert(normalizedVocabulary);
  if (vocabResult.error) throw vocabResult.error;

  console.log(`Syncing ${normalizedQuizQuestions.length} quiz question rows`);
  const questionResult = await supabase.from('jaeasy_quiz_questions').upsert(normalizedQuizQuestions);
  if (questionResult.error) throw questionResult.error;

  console.log(`Syncing ${normalizedSrsRecords.length} SRS rows`);
  const srsResult = await supabase
    .from('jaeasy_user_vocab_srs')
    .upsert(normalizedSrsRecords, { onConflict: 'user_id,vocab_id' });
  if (srsResult.error) throw srsResult.error;

  console.log(`Syncing ${normalizedQuizAttempts.length} quiz attempt rows`);
  const attemptsResult = await supabase.from('jaeasy_quiz_attempts').upsert(normalizedQuizAttempts);
  if (attemptsResult.error) throw attemptsResult.error;

  console.log('Jaeasy data sync completed.');
}

main().catch((error) => {
  console.error('Failed to sync Jaeasy data:', error.message);
  process.exitCode = 1;
});
