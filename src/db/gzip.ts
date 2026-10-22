// Backups are gzipped JSON (decisions §19). Reading tells gzip from plain JSON by its first two
// bytes, never by the file's name, so older plain backups still import.

import { isGzip } from '../shared/backupFile';

function through(file: Blob, transform: CompressionStream | DecompressionStream): Promise<Blob> {
  return new Response(file.stream().pipeThrough(transform)).blob();
}

export function gzip(file: Blob): Promise<Blob> {
  return through(file, new CompressionStream('gzip'));
}

/** The backup's JSON: unzipped when the file is gzip, else the file as it is. */
export async function readBackup(file: Blob): Promise<Blob> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return isGzip(head) ? through(file, new DecompressionStream('gzip')) : file;
}
