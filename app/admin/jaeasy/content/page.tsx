import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireAdminSession } from '../../../lib/admin';
import {
  createManualQuizQuestion,
  createVocabularyItem,
  deleteManualQuizQuestion,
  deleteVocabularyItem,
  getGeneratedVocabQuestions,
  getJaeasyContentSummary,
  getManualQuizQuestions,
  getVocabularyCatalog,
  type JaeasyQuizQuestion,
  updateManualQuizQuestion,
  updateVocabularyItem,
} from '../../../lib/jaeasy-data';
import type { JlptLevel, QuizMode } from '../../../lib/jaeasy';

const jlptLevels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const quizTypes: QuizMode[] = ['grammar', 'reading'];

function getSingleValue(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function parseOptions(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function revalidateJaeasySurfaces() {
  revalidatePath('/admin/jaeasy');
  revalidatePath('/admin/jaeasy/content');
  revalidatePath('/jaeasy');
  revalidatePath('/jaeasy/quiz');
  revalidatePath('/jaeasy/review');
}

async function createVocabularyAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  await createVocabularyItem({
    word: getSingleValue(formData.get('word')),
    reading: getSingleValue(formData.get('reading')),
    meaningZh: getSingleValue(formData.get('meaningZh')),
    pos: getSingleValue(formData.get('pos')),
    jlptLevel: getSingleValue(formData.get('jlptLevel')) as JlptLevel,
    exampleJa: getSingleValue(formData.get('exampleJa')),
    exampleZh: getSingleValue(formData.get('exampleZh')),
    audioUrl: getSingleValue(formData.get('audioUrl')) || null,
  });

  revalidateJaeasySurfaces();
}

async function updateVocabularyAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  await updateVocabularyItem(Number(formData.get('id') ?? 0), {
    word: getSingleValue(formData.get('word')),
    reading: getSingleValue(formData.get('reading')),
    meaningZh: getSingleValue(formData.get('meaningZh')),
    pos: getSingleValue(formData.get('pos')),
    jlptLevel: getSingleValue(formData.get('jlptLevel')) as JlptLevel,
    exampleJa: getSingleValue(formData.get('exampleJa')),
    exampleZh: getSingleValue(formData.get('exampleZh')),
    audioUrl: getSingleValue(formData.get('audioUrl')) || null,
  });

  revalidateJaeasySurfaces();
}

async function deleteVocabularyAction(formData: FormData) {
  'use server';

  await requireAdminSession();
  await deleteVocabularyItem(Number(formData.get('id') ?? 0));
  revalidateJaeasySurfaces();
}

async function createQuizQuestionAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  const options = parseOptions(getSingleValue(formData.get('options')));
  const answerIndex = Number(formData.get('answerIndex') ?? 0);

  await createManualQuizQuestion({
    type: getSingleValue(formData.get('type')) as QuizMode,
    jlptLevel: getSingleValue(formData.get('jlptLevel')) as JlptLevel,
    question: getSingleValue(formData.get('question')),
    options,
    answerIndex,
    explanation: getSingleValue(formData.get('explanation')) || null,
  });

  revalidateJaeasySurfaces();
}

async function updateQuizQuestionAction(formData: FormData) {
  'use server';

  await requireAdminSession();

  const options = parseOptions(getSingleValue(formData.get('options')));
  const answerIndex = Number(formData.get('answerIndex') ?? 0);

  await updateManualQuizQuestion(getSingleValue(formData.get('id')), {
    type: getSingleValue(formData.get('type')) as QuizMode,
    jlptLevel: getSingleValue(formData.get('jlptLevel')) as JlptLevel,
    question: getSingleValue(formData.get('question')),
    options,
    answerIndex,
    explanation: getSingleValue(formData.get('explanation')) || null,
  });

  revalidateJaeasySurfaces();
}

async function deleteQuizQuestionAction(formData: FormData) {
  'use server';

  await requireAdminSession();
  await deleteManualQuizQuestion(getSingleValue(formData.get('id')));
  revalidateJaeasySurfaces();
}

export default async function AdminJaeasyContentPage() {
  await requireAdminSession();

  const [summary, vocabulary, manualQuestions, generatedVocabQuestions] = await Promise.all([
    getJaeasyContentSummary(),
    getVocabularyCatalog(),
    getManualQuizQuestions(),
    getGeneratedVocabQuestions(),
  ]);

  return (
    <main className='mx-auto max-w-7xl px-6 py-10'>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-emerald-700'>老師後台 / Jaeasy</p>
          <h1 className='text-3xl font-bold'>字庫與題庫管理</h1>
          <p className='mt-2 text-sm text-slate-600'>這裡是老師之後新增單字、文法題、閱讀題的主要入口。</p>
        </div>
        <div className='flex gap-3 text-sm font-semibold underline'>
          <Link href='/admin/jaeasy'>回自學中心後台</Link>
          <Link href='/jaeasy/quiz?level=N5&type=vocab'>看前台測驗</Link>
        </div>
      </header>

      <section className='grid gap-4 md:grid-cols-4'>
        <MetricCard label='單字總量' value={`${summary.vocabularyCount}`} />
        <MetricCard label='自動單字題' value={`${summary.generatedVocabQuestionCount}`} />
        <MetricCard label='文法手動題' value={`${summary.grammarQuestionCount}`} />
        <MetricCard label='閱讀手動題' value={`${summary.readingQuestionCount}`} />
      </section>

      <section className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
        <article className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>新增單字</h2>
          <p className='mt-2 text-sm leading-7 text-slate-600'>只要新增一筆單字，系統就會自動為它產生對應的 vocab 測驗題。</p>
          <form action={createVocabularyAction} className='mt-6 grid gap-4 md:grid-cols-2'>
            <Field label='日文字'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='word' required />
            </Field>
            <Field label='讀音'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='reading' required />
            </Field>
            <Field label='中文意思'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='meaningZh' required />
            </Field>
            <Field label='詞性'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='pos' placeholder='名詞 / 動詞 / 形容詞' required />
            </Field>
            <Field label='JLPT 等級'>
              <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='jlptLevel'>
                {jlptLevels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label='音檔 URL'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='audioUrl' />
            </Field>
            <Field className='md:col-span-2' label='日文例句'>
              <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='exampleJa' required rows={3} />
            </Field>
            <Field className='md:col-span-2' label='中文例句'>
              <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='exampleZh' required rows={3} />
            </Field>
            <button className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white md:col-span-2' type='submit'>
              新增單字並更新自動題
            </button>
          </form>
        </article>

        <article className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>新增文法 / 閱讀題</h2>
          <p className='mt-2 text-sm leading-7 text-slate-600'>文法題與閱讀題是手動題庫，老師新增後前台測驗就會立即抽得到。</p>
          <form action={createQuizQuestionAction} className='mt-6 grid gap-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <Field label='題型'>
                <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='type'>
                  {quizTypes.map((item) => (
                    <option key={item} value={item}>
                      {item === 'grammar' ? '文法' : '閱讀'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label='JLPT 等級'>
                <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='jlptLevel'>
                  {jlptLevels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label='題目內容'>
              <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='question' required rows={4} />
            </Field>
            <Field label='選項'>
              <textarea
                className='mt-1 block w-full rounded border px-3 py-2 font-normal'
                name='options'
                placeholder={'每行一個選項\n選項 A\n選項 B\n選項 C\n選項 D'}
                required
                rows={5}
              />
            </Field>
            <Field label='正確答案索引'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue='0' min='0' name='answerIndex' type='number' />
            </Field>
            <Field label='解析'>
              <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' name='explanation' rows={3} />
            </Field>
            <button className='rounded bg-slate-950 px-4 py-3 text-sm font-semibold text-white' type='submit'>
              新增題目
            </button>
          </form>
        </article>
      </section>

      <section className='mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
        <article className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>字庫清單</h2>
          <p className='mt-2 text-sm leading-7 text-slate-600'>這裡編輯的內容會同步影響前台單字顯示，以及自動產生的 vocab 題。</p>
          <div className='mt-6 grid gap-4'>
            {vocabulary.map((item) => (
              <VocabularyEditor
                item={item}
                key={item.id}
                onDelete={deleteVocabularyAction}
                onUpdate={updateVocabularyAction}
              />
            ))}
          </div>
        </article>

        <article className='rounded border bg-white p-6 shadow-sm'>
          <h2 className='text-xl font-semibold'>手動題庫</h2>
          <p className='mt-2 text-sm leading-7 text-slate-600'>目前後台直接管理 grammar / reading 題。vocab 題則由字庫自動生成。</p>
          <div className='mt-6 grid gap-4'>
            {manualQuestions.map((item) => (
              <QuizQuestionEditor
                item={item}
                key={item.id}
                onDelete={deleteQuizQuestionAction}
                onUpdate={updateQuizQuestionAction}
              />
            ))}
          </div>
        </article>
      </section>

      <section className='mt-8 rounded border bg-white p-6 shadow-sm'>
        <h2 className='text-xl font-semibold'>自動單字題預覽</h2>
        <p className='mt-2 text-sm leading-7 text-slate-600'>這區不用手動編輯，因為它是從字庫自動產生，方便老師理解前台究竟怎麼出題。</p>
        <div className='mt-6 grid gap-3'>
          {generatedVocabQuestions.slice(0, 8).map((item) => (
            <article key={item.id} className='rounded border border-slate-200 p-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-sm font-bold text-sky-700'>
                  {item.jlptLevel} / {item.type}
                </p>
                <span className='text-xs text-slate-500'>{item.id}</span>
              </div>
              <p className='mt-3 text-sm leading-7 text-slate-700'>{item.question}</p>
              <p className='mt-3 text-xs text-slate-500'>選項：{item.options.join(' / ')}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className='rounded border bg-white p-5 shadow-sm'>
      <p className='text-sm text-slate-500'>{label}</p>
      <p className='mt-2 text-3xl font-bold'>{value}</p>
    </article>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`text-sm font-semibold ${className ?? ''}`}>
      {label}
      {children}
    </label>
  );
}

function VocabularyEditor({
  item,
  onUpdate,
  onDelete,
}: {
  item: Awaited<ReturnType<typeof getVocabularyCatalog>>[number];
  onUpdate: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  return (
    <article className='rounded border border-slate-200 p-4'>
      <div className='grid gap-4'>
        <form action={onUpdate} className='grid gap-4'>
          <input name='id' type='hidden' value={item.id} />
          <div className='grid gap-4 md:grid-cols-4'>
            <Field label='日文字'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.word} name='word' required />
            </Field>
            <Field label='讀音'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.reading} name='reading' required />
            </Field>
            <Field label='中文意思'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.meaningZh} name='meaningZh' required />
            </Field>
            <Field label='詞性'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.pos} name='pos' required />
            </Field>
          </div>
          <div className='grid gap-4 md:grid-cols-3'>
            <Field label='JLPT 等級'>
              <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.jlptLevel} name='jlptLevel'>
                {jlptLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
            <Field className='md:col-span-2' label='音檔 URL'>
              <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.audioUrl ?? ''} name='audioUrl' />
            </Field>
          </div>
          <Field label='日文例句'>
            <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.exampleJa} name='exampleJa' required rows={2} />
          </Field>
          <Field label='中文例句'>
            <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.exampleZh} name='exampleZh' required rows={2} />
          </Field>
          <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white' type='submit'>
            儲存單字
          </button>
        </form>
        <div className='flex flex-wrap gap-3'>
          <form action={onDelete}>
            <input name='id' type='hidden' value={item.id} />
            <button className='rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-600' type='submit'>
              刪除單字
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function QuizQuestionEditor({
  item,
  onUpdate,
  onDelete,
}: {
  item: JaeasyQuizQuestion;
  onUpdate: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  return (
    <article className='rounded border border-slate-200 p-4'>
      <div className='grid gap-4'>
        <form action={onUpdate} className='grid gap-4'>
          <input name='id' type='hidden' value={item.id} />
          <div className='grid gap-4 md:grid-cols-2'>
            <Field label='題型'>
              <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.type} name='type'>
                {quizTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === 'grammar' ? '文法' : '閱讀'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label='JLPT 等級'>
              <select className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.jlptLevel} name='jlptLevel'>
                {jlptLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label='題目內容'>
            <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.question} name='question' required rows={4} />
          </Field>
          <Field label='選項'>
            <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.options.join('\n')} name='options' required rows={5} />
          </Field>
          <Field label='正確答案索引'>
            <input className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.answerIndex} min='0' name='answerIndex' type='number' />
          </Field>
          <Field label='解析'>
            <textarea className='mt-1 block w-full rounded border px-3 py-2 font-normal' defaultValue={item.explanation ?? ''} name='explanation' rows={3} />
          </Field>
          <button className='rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white' type='submit'>
            儲存題目
          </button>
        </form>
        <div className='flex flex-wrap gap-3'>
          <form action={onDelete}>
            <input name='id' type='hidden' value={item.id} />
            <button className='rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-600' type='submit'>
              刪除題目
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
