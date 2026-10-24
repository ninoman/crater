import { useState } from 'react';
import { type CsvExportStatus, useCsvExport } from '../hooks/useCsvExport';
import type { CsvKind } from '../shared/exportCsv';
import type { ForYouMode } from '../shared/forYou';
import { Button, Select, StatusDot } from '../ui';

const NAMES: Record<CsvKind, string> = {
  wishlist: 'wishlist',
  collection: 'collection',
  'for-you': 'For you list',
};

const MODES = [
  { value: 'all', label: 'All time' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'deep', label: 'Deep cuts' },
] as const satisfies readonly { value: ForYouMode; label: string }[];

function StatusLine({ status }: { status: CsvExportStatus }) {
  switch (status.state) {
    case 'idle':
    case 'working':
      return 'Your wishlist or collection with tags, notes and ratings, or a For you list, for a spreadsheet.';
    case 'exported':
      return (
        <StatusDot tone="ok">
          Exported {status.rows} {status.rows === 1 ? 'row' : 'rows'} from your {NAMES[status.kind]}
        </StatusDot>
      );
    case 'empty':
      return (
        <StatusDot tone="warning">Your {NAMES[status.kind]} has nothing to export yet.</StatusDot>
      );
    case 'error':
      return <StatusDot tone="error">{status.error}</StatusDot>;
  }
}

/** Downloads your lists as CSV files. */
export function CsvExport() {
  const { status, exportCsv } = useCsvExport();
  const [mode, setMode] = useState<ForYouMode>('all');
  const working = status.state === 'working';

  return (
    <section className="dh-danger dh-danger--wrap" aria-label="CSV export">
      <div className="dh-danger__text">
        <span className="dh-danger__title">CSV export</span>
        <span className="dh-danger__status">
          <StatusLine status={status} />
        </span>
      </div>
      <div className="dh-danger__actions">
        <Button disabled={working} onClick={() => void exportCsv('wishlist', mode)}>
          Wishlist
        </Button>
        <Button disabled={working} onClick={() => void exportCsv('collection', mode)}>
          Collection
        </Button>
        <Button disabled={working} onClick={() => void exportCsv('for-you', mode)}>
          For you
        </Button>
        <Select<ForYouMode> label="For you picks" options={MODES} value={mode} onChange={setMode} />
      </div>
    </section>
  );
}
