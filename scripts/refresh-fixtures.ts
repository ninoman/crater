// Re-captures the public (logged-out) fixtures, runs the real parsers on them and diffs their
// structure against the saved ones. Usage: npm run fixtures:refresh [-- --write] [-- <file>...]
//
//   (no flags)  capture into tests/fixtures/.fresh/ and report, saved fixtures untouched
//   --write     also overwrite the saved fixtures with the fresh captures
//   <file>...   only these fixtures (dependent ones like *-p2.json need their first page too)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { BandcampApiError } from '../src/bandcamp';
import { shapeOfBody } from './fixtures/extract';
import { diffShapes, isSameShape, type ShapeDiff } from './fixtures/shape';
import { SKIPPED_LOGGED_IN, SPECS, type Spec } from './fixtures/specs';

const FIXTURES = new URL('../tests/fixtures/', import.meta.url);
const FRESH = new URL('.fresh/', FIXTURES);

const args = process.argv.slice(2);
const write = args.includes('--write');
const only = args.filter((arg) => !arg.startsWith('--'));

// Same pace as the scanner: one request at a time, 1.5-3 s apart.
const pause = () => new Promise((done) => setTimeout(done, 1500 + Math.random() * 1500));

interface Result {
  file: string;
  status: 'ok' | 'drift' | 'broken' | 'skipped';
  notes: string[];
}

function describeDiff(diff: ShapeDiff): string[] {
  return [
    ...diff.removed.map((path) => `- removed ${path}`),
    ...diff.added.map((path) => `+ added   ${path}`),
    ...diff.changed.map((c) => `~ type    ${c.path}: ${c.was.join('|')} -> ${c.now.join('|')}`),
  ];
}

/** Checks the real parser: it must accept the body, or reject it with an API error if expected. */
function checkParser(spec: Spec, body: string): string | null {
  try {
    spec.parse(body);
    return spec.expectApiError ? 'parser accepted a response that used to be an API error' : null;
  } catch (error) {
    if (spec.expectApiError && error instanceof BandcampApiError) return null;
    return `parser: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
  }
}

async function capture(spec: Spec, fresh: Map<string, string>): Promise<Result> {
  const request = spec.request(fresh);
  if ('skip' in request) return { file: spec.file, status: 'skipped', notes: [request.skip] };

  const { method, headers, body } = request.init;
  const response = await fetch(request.url, { method, headers, body, credentials: 'omit' });
  const text = await response.text();
  const notes: string[] = [];
  if (!response.ok) notes.push(`HTTP ${response.status} ${response.statusText}`);

  await writeFile(new URL(spec.file, FRESH), text);
  fresh.set(spec.file, text);
  if (write && response.ok) await writeFile(new URL(spec.file, FIXTURES), text);

  const parserProblem = checkParser(spec, text);
  if (parserProblem) notes.push(parserProblem);

  try {
    const saved = await readFile(new URL(spec.file, FIXTURES), 'utf8');
    const diff = diffShapes(shapeOfBody(spec.file, saved), shapeOfBody(spec.file, text));
    if (!isSameShape(diff)) notes.push(...describeDiff(diff));
    const status = !response.ok || parserProblem ? 'broken' : isSameShape(diff) ? 'ok' : 'drift';
    return { file: spec.file, status, notes };
  } catch (error) {
    notes.push(`could not compare: ${String(error)}`);
    return { file: spec.file, status: 'broken', notes };
  }
}

async function main(): Promise<void> {
  const specs = only.length ? SPECS.filter((spec) => only.includes(spec.file)) : SPECS;
  const unknown = only.filter((file) => !SPECS.some((spec) => spec.file === file));
  if (unknown.length) throw new Error(`unknown fixture(s): ${unknown.join(', ')}`);

  await mkdir(FRESH, { recursive: true });
  const fresh = new Map<string, string>();
  const results: Result[] = [];

  for (const [index, spec] of specs.entries()) {
    if (index > 0) await pause();
    process.stdout.write(`capturing ${spec.file} ... `);
    try {
      const result = await capture(spec, fresh);
      results.push(result);
      console.log(result.status);
    } catch (error) {
      results.push({ file: spec.file, status: 'broken', notes: [`request failed: ${String(error)}`] });
      console.log('broken');
    }
  }

  console.log('\n=== Summary ===');
  for (const { file, status, notes } of results) {
    console.log(`${status.toUpperCase().padEnd(8)} ${file}`);
    for (const note of notes) console.log(`           ${note}`);
  }
  console.log(`\nSkipped (logged in, refresh by hand): ${SKIPPED_LOGGED_IN.join(', ')}`);
  console.log(`Fresh captures: tests/fixtures/.fresh/${write ? ' (saved fixtures overwritten)' : ''}`);

  const bad = results.filter((r) => r.status === 'broken' || r.status === 'drift');
  if (bad.length) process.exitCode = 1;
}

await main();
