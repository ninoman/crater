import { useState } from 'react';
import type { ItemKey } from '../../bandcamp';
import type { AlsoBoughtView } from '../../hooks/useAlsoBought';
import type { ScanProgressView } from '../../hooks/useScanProgress';
import type { ScannerStatusView } from '../../hooks/useScannerStatus';
import { EmptyState, Notice, RowList, type EmptyStateProps } from '../../ui';
import { AlsoBoughtRow } from './AlsoBoughtRow';

export interface AlsoBoughtListProps {
  view: AlsoBoughtView;
  progress: ScanProgressView;
  scanner: ScannerStatusView;
  onHide: (matchKey: ItemKey) => void;
}

/** The recommendations, or why there aren't any yet. */
export function AlsoBoughtList({ view, progress, scanner, onHide }: AlsoBoughtListProps) {
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);

  if (view.state === 'loading') return <EmptyState title="Loading recommendations…" />;
  if (view.state === 'unreachable') {
    return (
      <EmptyState
        tone="error"
        title="Background worker unreachable"
        description="Try reloading the extension from chrome://extensions."
      />
    );
  }
  const { rows } = view.result;
  const parserBroken = scanner.state === 'ready' && scanner.status.parserError !== null;
  if (rows.length === 0) {
    return <EmptyState {...(parserBroken ? PARSER_BROKEN : waiting(progress))} />;
  }

  return (
    <>
      {parserBroken && (
        <div className="dh-also-bought__notice">
          <Notice tone="error">
            Parser broken: Bandcamp changed something Dighead reads, so these won&apos;t update
            until Dighead is updated.
          </Notice>
        </div>
      )}
      <RowList label="Also bought">
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
    </>
  );
}

const PARSER_BROKEN: EmptyStateProps = {
  tone: 'error',
  title: 'Parser broken',
  description:
    "Bandcamp changed something Dighead reads, so it can't scan fans right now. Dighead needs an update.",
};

/** No rows yet: say what we're waiting for. */
function waiting(progress: ScanProgressView): EmptyStateProps {
  if (progress.state !== 'ready') return { title: 'Checking scan status…' };
  const { scanned, total, listed } = progress.progress;
  if (!listed) {
    return {
      title: 'Queued for scanning',
      description: "Dighead will read this release's supporters shortly.",
    };
  }
  if (total === 0) {
    return {
      title: 'No public supporters yet',
      description: "Nobody shows up as owning this release, so there's nothing to compare.",
    };
  }
  if (scanned < total) {
    return {
      title: 'Scanning supporters…',
      description:
        "Recommendations appear once two supporters share a release you don't own. Collections are read slowly, to stay polite to Bandcamp.",
    };
  }
  return {
    title: 'Nothing in common yet',
    description: `No release is shared by two of the ${total} supporters, apart from ones you own, wishlisted or hid.`,
  };
}
