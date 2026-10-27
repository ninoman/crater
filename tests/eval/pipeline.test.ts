import './env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CraterDb } from '../../src/db';
import { loadBackup, runEval } from './pipeline';
import { formatReport } from './report';
import { syntheticBackup } from './syntheticBackup';

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`eval-test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('runEval on a synthetic backup', () => {
  it('runs both splits and leaves the database as it found it', async () => {
    await loadBackup(db, await syntheticBackup());
    const before = await db.ownership.where('fanId').equals(1).count();

    const { splits, notes } = await runEval(db);

    expect(notes).toEqual([]);
    expect(splits.map((s) => [s.folds, s.heldOut])).toEqual([
      [1, [8]],
      [5, [8, 8, 8, 8, 8]],
    ]);
    expect(await db.ownership.where('fanId').equals(1).count()).toBe(before);
    for (const split of splits) {
      const forYou = split.rows.find((r) => r.kind === 'forYou' && r.nicheCap === 100);
      expect(forYou?.at[100].recall?.mean).toBeGreaterThan(0);
      expect(forYou?.at[100].recall?.mean).toBeLessThanOrEqual(1);
      expect(split.rows.filter((r) => r.kind === 'deepCuts')).toHaveLength(48);
    }
  });

  it('prints aggregate numbers and the leakage caveat', async () => {
    await loadBackup(db, await syntheticBackup());
    const { splits } = await runEval(db);
    const text = formatReport(splits, 5);
    expect(text).toContain('Temporal (newest 20%)');
    expect(text).toContain('Random (5 folds)');
    expect(text).toContain('residual leakage');
    expect(text).toMatch(/Deep cuts β=/);
    expect(text).not.toMatch(/Release \d|fan\d/);
  });
});
