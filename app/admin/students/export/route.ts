import { requireAdminSession } from '../../../lib/admin';
import {
  filterUnifiedStudents,
  getStudentExportHeaders,
  getStudentExportRows,
  getUnifiedStudentRows,
} from '../../../lib/admin-students';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  await requireAdminSession();

  const { searchParams } = new URL(request.url);
  const students = await getUnifiedStudentRows();
  const filteredStudents = filterUnifiedStudents(students, {
    keyword: searchParams.get('q') ?? '',
    memberType: searchParams.get('memberType') ?? 'all',
    zoomStatus: searchParams.get('zoomStatus') ?? 'all',
    course: searchParams.get('course') ?? 'all',
  });

  const worksheet = XLSX.utils.aoa_to_sheet([getStudentExportHeaders(), ...getStudentExportRows(filteredStudents)]);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  worksheet['!autofilter'] = { ref: 'A1:O1' };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '學生主名單');

  const xlsxBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  }) as Buffer;
  const fileName = `students-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(xlsxBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
