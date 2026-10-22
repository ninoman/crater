import { describe, expect, it } from 'vitest';
import { renameTables } from './renameTables';

const BACKUP = JSON.stringify({
  formatName: 'dexie',
  data: {
    tables: [
      { name: 'twins', schema: 'fanId,score', rowCount: 1 },
      { name: 'tags', schema: '++id,&nameKey', rowCount: 1 },
    ],
    data: [
      { tableName: 'twins', inbound: true, rows: [{ fanId: 1, score: 2 }] },
      { tableName: 'tags', inbound: true, rows: [{ id: 1, name: 'twins', nameKey: 'twins' }] },
    ],
  },
});

/** A blob read back in chunks of `size` bytes, so names land across chunk edges. */
function chunked(text: string, size: number): Blob {
  const bytes = new TextEncoder().encode(text);
  const parts: Uint8Array<ArrayBuffer>[] = [];
  for (let i = 0; i < bytes.length; i += size) parts.push(bytes.slice(i, i + size));
  return new Blob(parts);
}

describe('renameTables', () => {
  it('renames the table in the header and the data, leaving row values alone', async () => {
    const renamed = JSON.parse(
      await (await renameTables(new Blob([BACKUP]), { twins: 'crateMates' })).text(),
    );
    expect(renamed.data.tables.map((t: { name: string }) => t.name)).toEqual([
      'crateMates',
      'tags',
    ]);
    expect(renamed.data.data.map((t: { tableName: string }) => t.tableName)).toEqual([
      'crateMates',
      'tags',
    ]);
    expect(renamed.data.data[1].rows[0]).toEqual({ id: 1, name: 'twins', nameKey: 'twins' });
  });

  it('finds names split across chunks', async () => {
    const expected = BACKUP.replaceAll(
      '"name":"twins","schema"',
      '"name":"crateMates","schema"',
    ).replaceAll('"tableName":"twins"', '"tableName":"crateMates"');
    for (const size of [1, 3, 7, 16]) {
      const renamed = await renameTables(chunked(BACKUP, size), { twins: 'crateMates' });
      expect(await renamed.text()).toBe(expected);
    }
  });

  it('keeps multi-byte characters split across chunks', async () => {
    const text = '{"name":"twins","schema":"","note":"ünïcødé ✓"}';
    const renamed = await renameTables(chunked(text, 1), { twins: 'crateMates' });
    expect(await renamed.text()).toBe('{"name":"crateMates","schema":"","note":"ünïcødé ✓"}');
  });
});
