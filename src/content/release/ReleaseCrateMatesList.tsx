import type { ReleaseCrateMatesView } from '../../hooks/useReleaseCrateMates';
import type { ReleaseCrateMateRow } from '../../shared/releaseCrateMates';
import { Badge, EmptyState, ExternalIcon, LinkButton, Row, RowList, Tooltip } from '../../ui';
import { formatOverlap } from './formatReason';

/** Your crate mates who own this release, or why there aren't any to show. */
export function ReleaseCrateMatesList({ view }: { view: ReleaseCrateMatesView }) {
  if (view.state === 'loading') return <EmptyState title="Loading your crate mates…" />;
  if (view.state === 'unreachable') {
    return (
      <EmptyState
        tone="error"
        title="Background worker unreachable"
        description="Try reloading the extension from chrome://extensions."
      />
    );
  }
  const { rows, crateMateCount } = view.result;
  if (crateMateCount === 0) {
    return (
      <EmptyState
        title="No crate mates yet"
        description="Crate mates appear once your collection is synced and some fans are scanned."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="None of your crate mates own this"
        description={`None of your ${crateMateCount} closest crate mates has this in their collection, as far as Crater has scanned.`}
      />
    );
  }
  return (
    <RowList label="Crate mates who own this">
      {rows.map((row) => (
        <CrateMateRow key={row.fanId} row={row} />
      ))}
    </RowList>
  );
}

function CrateMateRow({ row }: { row: ReleaseCrateMateRow }) {
  return (
    <Row
      media={<span className="dh-crate-mate-rank">#{row.rank}</span>}
      title={<a href={row.profileUrl}>{row.name}</a>}
      meta={[formatOverlap(row.overlap)]}
      // Flagged crate mates share mostly one label's catalog with you (decisions §7).
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
