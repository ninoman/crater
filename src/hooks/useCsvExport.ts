import { useCallback, useState } from 'react';
import { type CsvKind, csvFilename, forYouCsv, itemsCsv } from '../shared/exportCsv';
import type { ForYouMode } from '../shared/forYou';
import { sendMessage } from '../shared/messages';
import { saveFile } from './saveFile';

export type CsvExportStatus =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'exported'; kind: CsvKind; rows: number }
  | { state: 'empty'; kind: CsvKind }
  | { state: 'error'; error: string };

/** The CSV text for one kind of export, read from the worker. */
async function build(kind: CsvKind, mode: ForYouMode): Promise<{ csv: string; rows: number }> {
  if (kind === 'for-you') {
    const { rows } = await sendMessage('getForYou', { mode });
    return { csv: forYouCsv(rows), rows: rows.length };
  }
  const source = kind;
  const [items, tags] = await Promise.all([
    sendMessage('listItems', { source }),
    sendMessage('listTags', {}),
  ]);
  return { csv: itemsCsv(source, items, tags), rows: items.length };
}

/** Exports your wishlist, your collection or a For you list as a CSV file (decisions §22). */
export function useCsvExport() {
  const [status, setStatus] = useState<CsvExportStatus>({ state: 'idle' });

  const exportCsv = useCallback(async (kind: CsvKind, mode: ForYouMode) => {
    setStatus({ state: 'working' });
    try {
      const { csv, rows } = await build(kind, mode);
      if (rows === 0) {
        setStatus({ state: 'empty', kind });
        return;
      }
      saveFile(csvFilename(kind, new Date()), new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      setStatus({ state: 'exported', kind, rows });
    } catch (error) {
      setStatus({ state: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  return { status, exportCsv };
}
