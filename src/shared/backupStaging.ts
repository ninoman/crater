// Hands a backup between the popup and the service worker. Messages are JSON, so a Blob can't
// travel in one; both sides share the extension's origin-private file system instead (decisions §10).

export type StagedFile = 'export' | 'import';

async function stagingFile(name: StagedFile, create: boolean): Promise<FileSystemFileHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getFileHandle(`backup-${name}.json`, { create });
}

export async function stageFile(name: StagedFile, content: Blob): Promise<void> {
  const writable = await (await stagingFile(name, true)).createWritable();
  await content.stream().pipeTo(writable);
}

/** A disk-backed File, so a large backup is never copied into memory. */
export async function readStagedFile(name: StagedFile): Promise<File> {
  return (await stagingFile(name, false)).getFile();
}

export async function discardStagedFile(name: StagedFile): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(`backup-${name}.json`).catch(() => undefined);
}
