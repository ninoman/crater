import { useState } from 'react';
import type { ItemKey } from '../../bandcamp';
import type { AlsoBoughtView } from '../../hooks/useAlsoBought';
import type { ScanProgressView } from '../../hooks/useScanProgress';
import { EmptyState, RowList } from '../../ui';
import { AlsoBoughtRow } from './AlsoBoughtRow';
import { Gathering } from './Gathering';
import { WarmupProgress } from './WarmupProgress';

export interface AlsoBoughtListProps {
  view: AlsoBoughtView;
  progress: ScanProgressView;
  /** A notice above says why the scanner isn't running. */
  scanStopped: boolean;
  /** The first wait is over: during the warm-up, show the picks so far instead of the loader. */
  showEarly: boolean;
  onHide: (matchKey: ItemKey) => void;
}

/** The recommendations, or why there aren't any yet. */
export function AlsoBoughtList({
  view,
  progress,
  scanStopped,
  showEarly,
  onHide,
}: AlsoBoughtListProps) {
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);

  if (view.state === 'loading') return <Gathering title="Loading recommendations…" />;
  if (view.state === 'unreachable') {
    return (
      <EmptyState
        tone="error"
        title="Background worker unreachable"
        description="Try reloading the extension from chrome://extensions."
      />
    );
  }
  const { rows, warmup } = view.result;
  const list = (label: string) => (
    <RowList label={label}>
      {rows.map((row) => (
        <AlsoBoughtRow
          key={row.matchKey}
          row={row}
          previewing={previewing === row.matchKey}
          onPreview={(open) => setPreviewing(open ? row.matchKey : null)}
          onHide={() => onHide(row.matchKey)}
        />
      ))}
    </RowList>
  );

  if (warmup) {
    const early = showEarly && rows.length > 0;
    // Before the supporter list is in there's nothing to warm up yet: say what we're waiting for.
    const listed = progress.state === 'ready' && progress.progress.listed;
    if (!listed && !early) return <Waiting progress={progress} scanStopped={scanStopped} />;
    return (
      <>
        <WarmupProgress warmup={warmup} scanStopped={scanStopped} early={early} />
        {early && list('Early picks')}
      </>
    );
  }
  if (rows.length === 0) return <Waiting progress={progress} scanStopped={scanStopped} />;
  return list('Also bought');
}

/** A wait the scan will end, or a final answer that it won't change. */
interface WaitState {
  busy: boolean;
  title: string;
  description?: string;
}

/** No rows yet: say what we're waiting for, over placeholders while the scan can still bring some. */
function Waiting({ progress, scanStopped }: { progress: ScanProgressView; scanStopped: boolean }) {
  const { busy, ...text } = waiting(progress, scanStopped);
  return busy ? <Gathering {...text} /> : <EmptyState {...text} />;
}

const SCAN_STOPPED: WaitState = {
  busy: false,
  title: 'No recommendations yet',
  description:
    'They appear as supporters are scanned, and the scanner is stopped for now. The notice above says why.',
};

function waiting(progress: ScanProgressView, scanStopped: boolean): WaitState {
  if (progress.state !== 'ready') return { busy: true, title: 'Checking scan status…' };
  const { scanned, total, listed } = progress.progress;
  if (scanStopped && (!listed || scanned < total)) return SCAN_STOPPED;
  if (!listed) {
    return {
      busy: true,
      title: 'Queued for scanning',
      description: "Dighead will read this release's supporters shortly.",
    };
  }
  if (total === 0) {
    return {
      busy: false,
      title: 'No public supporters yet',
      description: "Nobody shows up as owning this release, so there's nothing to compare.",
    };
  }
  if (scanned < total) {
    return {
      busy: true,
      title: 'Scanning supporters…',
      description:
        "Recommendations appear once two supporters share a release you don't own. Collections are read slowly, to stay polite to Bandcamp.",
    };
  }
  return {
    busy: false,
    title: 'Nothing in common yet',
    description: `No release is shared by two of the ${total} supporters, apart from ones you own, wishlisted or hid.`,
  };
}
