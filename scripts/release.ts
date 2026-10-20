// Cuts a Web Store build. Usage: npm run release:patch|minor|major, or npm run release:build.
//
//   patch|minor|major  test, bump version + changelog, build, zip to releases/<name>-<version>.zip
//   build              same checks and zip for the current version, no bump (first submission)
//
// Nothing is committed or tagged: review the diff, then commit and tag by hand (docs/release.md).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { releaseChangelog, unreleasedEntries } from './release/changelog';
import { type Bump, bumpVersion, isBump } from './release/version';

const root = new URL('../', import.meta.url);
const path = (file: string) => new URL(file, root);
const PACKAGE = path('package.json');
const LOCKFILE = path('package-lock.json');
const CHANGELOG = path('CHANGELOG.md');

const mode = process.argv[2];
if (mode !== 'build' && !isBump(mode)) {
  console.error('Usage: release.ts patch|minor|major|build');
  process.exit(1);
}

const run = (command: string, args: string[], cwd = root) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' });

const read = (file: URL) => readFileSync(file, 'utf8');

// Name and version come from the built manifest, so renaming the extension (ROADMAP 8.1) needs
// no edit here and the zip name can't disagree with what ships.
function builtManifest(): { name: string; version: string } {
  return JSON.parse(read(path('dist/manifest.json')));
}

function setVersion(version: string) {
  const pkg = JSON.parse(read(PACKAGE));
  pkg.version = version;
  writeFileSync(PACKAGE, `${JSON.stringify(pkg, null, 2)}\n`);
  const lock = JSON.parse(read(LOCKFILE));
  lock.version = version;
  lock.packages[''].version = version;
  writeFileSync(LOCKFILE, `${JSON.stringify(lock, null, 2)}\n`);
}

function zipDist() {
  const { name, version } = builtManifest();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (version !== next) throw new Error(`dist/manifest.json is ${version}, expected ${next}`);
  const releases = path('releases/');
  mkdirSync(releases, { recursive: true });
  const zip = new URL(`${slug}-${version}.zip`, releases);
  rmSync(zip, { force: true });
  // -X drops extra file attributes so the same dist/ always zips to the same bytes.
  run('zip', ['-r', '-X', zip.pathname, '.'], path('dist/'));
  return zip.pathname;
}

const status = execFileSync('git', ['status', '--porcelain'], { cwd: root }).toString().trim();
if (status) {
  console.error(`Working tree is not clean, commit or stash first:\n${status}`);
  process.exit(1);
}

const current: string = JSON.parse(read(PACKAGE)).version;
const next = mode === 'build' ? current : bumpVersion(current, mode as Bump);

if (mode === 'build') {
  run('npm', ['test']);
  run('npm', ['run', 'build']);
} else {
  const changelog = read(CHANGELOG);
  if (!unreleasedEntries(changelog)) {
    console.error('Nothing under "## [Unreleased]" in CHANGELOG.md: describe the change first.');
    process.exit(1);
  }
  run('npm', ['test']);
  const originals = { pkg: read(PACKAGE), lock: read(LOCKFILE), changelog };
  try {
    setVersion(next);
    writeFileSync(CHANGELOG, releaseChangelog(changelog, next, new Date().toLocaleDateString('en-CA')));
    run('npm', ['run', 'build']);
  } catch (error) {
    // Don't leave a half-bumped tree behind when the build fails.
    writeFileSync(PACKAGE, originals.pkg);
    writeFileSync(LOCKFILE, originals.lock);
    writeFileSync(CHANGELOG, originals.changelog);
    throw error;
  }
}

console.log(`\nBuilt ${next}: ${zipDist()}`);
if (mode !== 'build') {
  console.log(`Next: git commit -am "release: v${next}" && git tag v${next}`);
}
