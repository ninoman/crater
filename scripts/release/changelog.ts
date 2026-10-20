// Keep a Changelog format: new entries pile up under "## [Unreleased]" and a release moves
// them under a dated version heading.

const UNRELEASED = '## [Unreleased]';
const NEXT_HEADING = /^## /m;

/** The entries waiting under Unreleased, trimmed. Empty string when there are none. */
export function unreleasedEntries(changelog: string): string {
  const start = changelog.indexOf(UNRELEASED);
  if (start === -1) throw new Error(`CHANGELOG.md has no "${UNRELEASED}" heading`);
  const body = changelog.slice(start + UNRELEASED.length);
  const end = body.search(NEXT_HEADING);
  return (end === -1 ? body : body.slice(0, end)).trim();
}

/** Moves the Unreleased entries under `## [version] - date`, leaving a fresh empty Unreleased. */
export function releaseChangelog(changelog: string, version: string, date: string): string {
  const entries = unreleasedEntries(changelog);
  if (!entries) throw new Error('Nothing under "## [Unreleased]" in CHANGELOG.md: add entries first');
  const start = changelog.indexOf(UNRELEASED);
  const rest = changelog.slice(start + UNRELEASED.length);
  const end = rest.search(NEXT_HEADING);
  const after = end === -1 ? '' : rest.slice(end);
  const head = changelog.slice(0, start);
  const section = `## [${version}] - ${date}\n\n${entries}\n`;
  return `${head}${UNRELEASED}\n\n${section}${after ? `\n${after}` : ''}`;
}
