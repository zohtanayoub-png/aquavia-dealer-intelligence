import { columnsFor, type ExportCompany, type ExportPreset } from '@/lib/export/columns';

/** RFC 4180 escaping. */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(companies: ExportCompany[], preset: ExportPreset = 'full'): string {
  const columns = columnsFor(preset);
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const rows = companies.map((company) =>
    columns.map((c) => escapeCsvCell(sanitize(c.value(company)))).join(','),
  );
  // BOM so Excel opens UTF-8 correctly on Windows — real-world requirement.
  return `﻿${[header, ...rows].join('\r\n')}\r\n`;
}

/**
 * Neutralise spreadsheet formula injection.
 * A company name legitimately starting with "=" must not execute in Excel.
 */
export function sanitize(value: string): string {
  const flat = value.replace(/\r?\n/g, ' ').trim();
  return /^[=+\-@\t\r]/.test(flat) ? `'${flat}` : flat;
}
