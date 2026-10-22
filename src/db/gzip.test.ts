import { describe, expect, it } from 'vitest';
import { gzip, readBackup } from './gzip';

const JSON_TEXT = '{"formatName":"dexie"}';

describe('backup files', () => {
  it('unzips a gzip file whatever it is called', async () => {
    const zipped = new File([await gzip(new Blob([JSON_TEXT]))], 'backup.json');
    expect(await (await readBackup(zipped)).text()).toBe(JSON_TEXT);
  });

  it('reads a plain JSON file as it is', async () => {
    const plain = new File([JSON_TEXT], 'backup.json.gz');
    expect(await (await readBackup(plain)).text()).toBe(JSON_TEXT);
  });

  it('zips to gzip magic bytes and back', async () => {
    const zipped = await gzip(new Blob([JSON_TEXT]));
    expect([...new Uint8Array(await zipped.slice(0, 2).arrayBuffer())]).toEqual([0x1f, 0x8b]);
    expect(zipped.size).not.toBe(JSON_TEXT.length);
    expect(await (await readBackup(zipped)).text()).toBe(JSON_TEXT);
  });

  it('reads an empty file without failing', async () => {
    expect(await (await readBackup(new Blob([]))).text()).toBe('');
  });
});
