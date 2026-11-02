// Zips the Chrome and Firefox builds of the current version, plus the source zip AMO asks
// for: pnpm release:build.
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
run('pnpm', ['build:firefox']);

// Name and version come from the built manifest, so renaming the extension (ROADMAP 8.1) needs
// no edit here and the zip name can't disagree with what ships.
const { name, version } = JSON.parse(readFileSync(path('dist/manifest.json'), 'utf8'));
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const releases = path('releases/');
mkdirSync(releases, { recursive: true });

const zipBuild = (dir: string, suffix: string) => {
  const zip = new URL(`${slug}-${version}${suffix}.zip`, releases);
  rmSync(zip, { force: true });
  // -X drops extra file attributes so the same build always zips to the same bytes.
  run('zip', ['-r', '-q', '-X', zip.pathname, '.'], path(dir));
  return zip.pathname;
};

const chromeZip = zipBuild('dist/', '');
const firefoxZip = zipBuild('dist-firefox/', '-firefox');
// AMO reviews bundled code against its source (decisions §26).
const sourceZip = new URL(`${slug}-${version}-source.zip`, releases).pathname;
run('git', ['archive', '--format=zip', '-o', sourceZip, 'HEAD']);

console.log(`\nBuilt ${version}:\n  ${chromeZip}\n  ${firefoxZip}\n  ${sourceZip}`);
