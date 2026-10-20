export type Bump = 'patch' | 'minor' | 'major';

export function isBump(value: string | undefined): value is Bump {
  return value === 'patch' || value === 'minor' || value === 'major';
}

/** Plain x.y.z only: the Web Store rejects pre-release suffixes in `version`. */
export function bumpVersion(version: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Not a plain x.y.z version: ${version}`);
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
