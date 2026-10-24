import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from './csv';

describe('csvField', () => {
  it('leaves plain text and numbers alone, and null empty', () => {
    expect(csvField('Burial')).toBe('Burial');
    expect(csvField(15.5)).toBe('15.5');
    expect(csvField(-3)).toBe('-3');
    expect(csvField(null)).toBe('');
  });

  it('quotes commas, quotes and line breaks, doubling the quotes', () => {
    expect(csvField('Hello, world')).toBe('"Hello, world"');
    expect(csvField('the "best" one')).toBe('"the ""best"" one"');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    expect(csvField('=1+1')).toBe("'=1+1");
    expect(csvField('+44 20')).toBe("'+44 20");
    expect(csvField('-cmd')).toBe("'-cmd");
    expect(csvField('@sum')).toBe("'@sum");
    expect(csvField('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });

  it('keeps non-Latin text as it is', () => {
    expect(csvField('時間')).toBe('時間');
  });
});

describe('toCsv', () => {
  const columns = [
    { header: 'Name', cell: (row: { n: string; v: number | null }) => row.n },
    { header: 'Value', cell: (row: { n: string; v: number | null }) => row.v },
  ];

  it('starts with a byte order mark and a header, and ends each line with CRLF', () => {
    const csv = toCsv(columns, [
      { n: 'a, b', v: 1 },
      { n: 'c', v: null },
    ]);

    expect(csv).toBe('﻿Name,Value\r\n"a, b",1\r\nc,\r\n');
  });

  it('is just the header for no rows', () => {
    expect(toCsv(columns, [])).toBe('﻿Name,Value\r\n');
  });
});
