import { describe, expect, it } from 'vitest';
import { importSummaryText, readTagBackup, tagBackupFilename } from './tagBackupFile';

describe('tagBackupFilename', () => {
  it('uses the UTC date', () => {
    expect(tagBackupFilename(new Date('2026-10-20T12:00:00Z'))).toBe(
      'dighead-tags-2026-10-20.json',
    );
  });
});

describe('importSummaryText', () => {
  it('mentions skipped only when there are some', () => {
    expect(importSummaryText({ tagsCreated: 1, assigned: 2, skipped: 0 })).toBe(
      '1 tag added, 2 assignments applied',
    );
    expect(importSummaryText({ tagsCreated: 0, assigned: 1, skipped: 3 })).toBe(
      '0 tags added, 1 assignment applied, 3 skipped (no longer followed, wishlisted or owned)',
    );
  });
});

describe('readTagBackup', () => {
  it('accepts a backup', () => {
    const backup = {
      version: 3,
      tags: [{ name: 'jazz', assignments: [['fan', 1]], items: ['a5'] }],
      notes: [{ itemKey: 'a5', text: 'ask Sam', rating: 4 }],
    };
    expect(readTagBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('rejects text that is not JSON', () => {
    expect(() => readTagBackup('nope')).toThrow('valid JSON');
  });

  it('rejects JSON that is not a backup', () => {
    expect(() => readTagBackup('{"version":4,"tags":[]}')).toThrow('tags backup');
  });
});
