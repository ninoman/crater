// Offline evaluation of Deep cuts on your own full-database backup (ROADMAP "Deep cuts" step 5).
// Usage: pnpm eval <backup.json> [--all]
// Prints aggregate numbers only. Keep backups out of git: see .gitignore (backups/).

import './env';
import { readFileSync } from 'node:fs';
import { DigheadDb } from '../../src/db';
import { loadBackup, runEval } from './pipeline';
import { formatReport } from './report';

const TOP_DEEP_CUTS = 10;

const args = process.argv.slice(2);
const path = args.find((arg) => !arg.startsWith('--'));
if (!path) {
  console.error('Usage: pnpm eval <backup.json> [--all]');
  process.exit(1);
}

const db = new DigheadDb(`eval-${crypto.randomUUID()}`);
await db.open();
console.error(`Loading ${path} ...`);
await loadBackup(db, new Blob([readFileSync(path)]));
const { splits, notes } = await runEval(db, (message) => console.error(message));
for (const note of notes) console.log(`Note: ${note}`);
console.log(formatReport(splits, args.includes('--all') ? null : TOP_DEEP_CUTS));
