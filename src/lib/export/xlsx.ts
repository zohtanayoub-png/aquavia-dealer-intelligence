import ExcelJS from 'exceljs';
import { columnsFor, type ExportCompany, type ExportPreset } from '@/lib/export/columns';
import { sanitize } from '@/lib/export/csv';

/** Styled, filterable XLSX workbook. */
export async function toXlsx(
  companies: ExportCompany[],
  preset: ExportPreset = 'full',
  sheetName = 'Aquavia Prospects',
): Promise<Buffer> {
  const columns = columnsFor(preset);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aquavia Dealer Intelligence';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: c.width }));

  for (const company of companies) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.header, sanitize(c.value(company))])));
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D3E' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 22;

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Colour-code priority so an A prospect is visible at a glance.
  const priorityIndex = columns.findIndex((c) => c.header === 'Priority');
  if (priorityIndex >= 0) {
    const colours: Record<string, string> = {
      A: 'FFD5F5E3', B: 'FFD6EAF8', C: 'FFFDF2D0', D: 'FFF2F3F4',
    };
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cell = row.getCell(priorityIndex + 1);
      const argb = colours[String(cell.value ?? '')];
      if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
