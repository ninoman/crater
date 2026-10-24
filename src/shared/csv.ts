// CSV text from rows, as spreadsheets and Discogs imports read it (decisions §22). Pure.

export type CsvCell = string | number | null;

export interface CsvColumn<T> {
  header: string;
  cell: (row: T) => CsvCell;
}

/** Tells Excel the file is UTF-8, so accented artist names survive opening it by double-click. */
const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One field. Text that a spreadsheet would run as a formula (a title like "=1+1") gets a leading
 * apostrophe, and fields with a comma, quote or line break are quoted. Numbers are left alone.
 */
export function csvField(cell: CsvCell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return String(cell);
  const text = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A header row, then one row per item, with CRLF line ends as RFC 4180 asks. */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [
    columns.map((column) => csvField(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvField(column.cell(row))).join(',')),
  ];
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
