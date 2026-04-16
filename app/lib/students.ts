import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export type StudentRecord = {
  id: string;
  name: string;
  email: string;
  courseName: string;
  lessonCount: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

const studentsFilePath = path.join(process.cwd(), 'data', 'students.json');

async function ensureStudentsFile() {
  await fs.mkdir(path.dirname(studentsFilePath), { recursive: true });

  try {
    await fs.access(studentsFilePath);
  } catch {
    await fs.writeFile(studentsFilePath, '[]\n', 'utf8');
  }
}

export async function readStudents() {
  await ensureStudentsFile();
  const raw = await fs.readFile(studentsFilePath, 'utf8');
  const parsed = JSON.parse(raw) as StudentRecord[];
  return parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeStudents(students: StudentRecord[]) {
  await ensureStudentsFile();
  await fs.writeFile(studentsFilePath, `${JSON.stringify(students, null, 2)}\n`, 'utf8');
}

export async function createStudentRecord(input: Omit<StudentRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const students = await readStudents();
  const now = new Date().toISOString();

  const nextRecord: StudentRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  students.unshift(nextRecord);
  await writeStudents(students);
  return nextRecord;
}

export async function updateStudentRecord(id: string, updates: Omit<StudentRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const students = await readStudents();
  const index = students.findIndex((student) => student.id === id);

  if (index === -1) {
    throw new Error('找不到要更新的學員。');
  }

  students[index] = {
    ...students[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeStudents(students);
  return students[index];
}

export async function deleteStudentRecord(id: string) {
  const students = await readStudents();
  const nextStudents = students.filter((student) => student.id !== id);

  if (nextStudents.length === students.length) {
    throw new Error('找不到要刪除的學員。');
  }

  await writeStudents(nextStudents);
}
