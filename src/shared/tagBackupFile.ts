import { parseTagBackup, type TagBackup, type TagImportSummary } from './following';

export function tagBackupFilename(date: Date): string {
  return `crater-tags-${date.toISOString().slice(0, 10)}.json`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function importSummaryText({ tagsCreated, assigned, skipped }: TagImportSummary): string {
  const text = `${count(tagsCreated, 'tag')} added, ${count(assigned, 'assignment')} applied`;
  return skipped > 0
    ? `${text}, ${skipped} skipped (no longer followed, wishlisted or owned)`
    : text;
}

/** Reads the text of a chosen file. Throws a message fit for the user when it isn't a backup. */
export function readTagBackup(text: string): TagBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const backup = parseTagBackup(json);
  if (!backup) throw new Error("That file isn't a Crater tags backup.");
  return backup;
}
