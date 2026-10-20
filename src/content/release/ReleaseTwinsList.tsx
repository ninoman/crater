import type { ReleaseTwinsView } from '../../hooks/useReleaseTwins';
import type { ReleaseTwinRow } from '../../shared/releaseTwins';
import { Badge, EmptyState, ExternalIcon, LinkButton, Row, RowList, Tooltip } from '../../ui';
import { formatOverlap } from './formatReason';

/** Your twins who own this release, or why there aren't any to show. */
export function ReleaseTwinsList({ view }: { view: ReleaseTwinsView }) {
  if (view.state === 'loading') return <EmptyState title="Loading your twins…" />;
  if (view.state === 'unreachable') {
    return (
      <EmptyState
        tone="error"
        title="Background worker unreachable"
        description="Try reloading the extension from chrome://extensions."
      />
    );
  }
  const { rows, twinCount } = view.result;
  if (twinCount === 0) {
    return (
      <EmptyState
        title="No taste twins yet"
        description="Twins appear once your collection is synced and some fans are scanned."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="None of your twins own this"
        description={`None of your ${twinCount} closest twins has this in their collection, as far as Dighead has scanned.`}
      />
    );
  }
  return (
    <RowList label="Twins who own this">
      {rows.map((row) => (
        <TwinRow key={row.fanId} row={row} />
      ))}
    </RowList>
  );
}

function TwinRow({ row }: { row: ReleaseTwinRow }) {
  return (
    <Row
      media={<span className="dh-twin-rank">#{row.rank}</span>}
      title={<a href={row.profileUrl}>{row.name}</a>}
      meta={[formatOverlap(row.overlap)]}
      // Flagged twins share mostly one label's catalog with you (decisions §7).
      badges={row.labelCluster && <Badge>mostly one label</Badge>}
      actions={
        <Tooltip content="Open profile in a new tab">
          <LinkButton
            variant="ghost"
            icon
            href={row.profileUrl}
            target="_blank"
            rel="noopener"
            aria-label={`Open ${row.name}'s profile in a new tab`}
          >
            <ExternalIcon />
          </LinkButton>
        </Tooltip>
      }
    />
  );
}
