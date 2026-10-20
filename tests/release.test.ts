import { describe, expect, it } from 'vitest';
import { releaseChangelog, unreleasedEntries } from '../scripts/release/changelog';
import { bumpVersion } from '../scripts/release/version';

describe('bumpVersion', () => {
  it('bumps each part and resets the lower ones', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('rejects pre-release versions', () => {
    expect(() => bumpVersion('1.2.3-beta.1', 'patch')).toThrow();
  });
});

const CHANGELOG = `# Changelog

## [Unreleased]

### Fixed

- A parser.

## [0.1.0] - 2026-10-20

### Added

- Everything.
`;

describe('changelog', () => {
  it('reads the unreleased entries', () => {
    expect(unreleasedEntries(CHANGELOG)).toBe('### Fixed\n\n- A parser.');
  });

  it('moves them under a dated version and keeps older sections', () => {
    const out = releaseChangelog(CHANGELOG, '0.1.1', '2026-11-01');
    expect(out).toBe(`# Changelog

## [Unreleased]

## [0.1.1] - 2026-11-01

### Fixed

- A parser.

## [0.1.0] - 2026-10-20

### Added

- Everything.
`);
    expect(unreleasedEntries(out)).toBe('');
  });

  it('refuses to release an empty Unreleased section', () => {
    expect(() =>
      releaseChangelog(releaseChangelog(CHANGELOG, '0.1.1', 'd'), '0.1.2', 'd'),
    ).toThrow();
  });
});
