// Zips a Web Store build of the current version: pnpm release:build.
// Versioning, the changelog and store submission are done by release-please in CI
// (docs/releasing.md); this is for the first listing, which the store API can't create.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const path = (file: string) => new URL(file, root);

const run = (command: string, args: string[], cwd = root) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' });

run('pnpm', ['test']);
run('pnpm', ['build']);

// Name and version come from the built manifest, so renaming the extension (ROADMAP 8.1) needs
// no edit here and the zip name can't disagree with what ships.
const { name, version } = JSON.parse(readFileSync(path('dist/manifest.json'), 'utf8'));
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const releases = path('releases/');
mkdirSync(releases, { recursive: true });
const zip = new URL(`${slug}-${version}.zip`, releases);
rmSync(zip, { force: true });
// -X drops extra file attributes so the same dist/ always zips to the same bytes.
run('zip', ['-r', '-q', '-X', zip.pathname, '.'], path('dist/'));

console.log(`\nBuilt ${version}: ${zip.pathname}`);
