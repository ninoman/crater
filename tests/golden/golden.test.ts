import 'fake-indexeddb/auto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { DigheadDb, exportDatabase } from '../../src/db';
import { collectOutputs } from './outputs';
import { buildScenario } from './scenario';

// `UPDATE_GOLDEN=1 pnpm test tests/golden` rewrites golden.json. Only do that on code whose
// outputs are known good: the point is that storage changes leave them alone (decisions §19).
const GOLDEN = join(import.meta.dirname, 'golden.json');

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`golden-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

it('every recommender answers as recorded', async () => {
  await buildScenario(db);
  const outputs = JSON.parse(JSON.stringify(await collectOutputs(db)));
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(outputs, null, 1)}\n`);
  }
  expect(outputs).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
});

it.skipIf(!process.env.UPDATE_GOLDEN)('saves the scenario as a backup fixture', async () => {
  await buildScenario(db);
  const { file } = await exportDatabase(db);
  writeFileSync(join(import.meta.dirname, `v${db.verno}-backup.json`), await file.text());
});
