import { useState } from 'react';
import type { ItemKey } from '../../../bandcamp';
import type { CrateMatesLatestResult } from '../../../shared/crateMatesLatest';
import { ReleaseRow, RowList, StatusDot } from '../../../ui';
import { ReleasePreview } from '../../shared/ReleasePreview';
import { formatChecking, formatLatestReason, formatLatestSummary } from './latestText';

export interface LatestListProps {
  result: CrateMatesLatestResult;
  /** For "3 days ago". */
  now: number;
  onHide: (matchKey: ItemKey) => void;
}

/** Your crate mates' recent buys, newest first, one preview open at a time. */
export function LatestList({ result, now, onHide }: LatestListProps) {
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {formatLatestSummary(result.rows.length, result.crateMatesUsed, result.windowDays)}
        </p>
        {result.checking > 0 && (
          <StatusDot tone="neutral">{formatChecking(result.checking)}</StatusDot>
        )}
      </div>
      <div className="dh-profile__list">
        <RowList label="Crate mates' latest">
          {result.rows.map((row) => (
            <ReleaseRow
              key={row.matchKey}
              release={row}
              reason={formatLatestReason(row, now)}
              previewing={previewing === row.matchKey}
              preview={<ReleasePreview url={row.url} name={`${row.artist} – ${row.title}`} />}
              onPreview={(open) => setPreviewing(open ? row.matchKey : null)}
              onHide={() => onHide(row.matchKey)}
            />
          ))}
        </RowList>
      </div>
      <p className="dh-profile__note">
        What your top crate mates on the Lately board, then the all-time one, bought recently and
        you don&apos;t own. Dighead re-reads your closest lately crate mates every week, everyone
        else monthly. Hidden, owned and wishlisted releases are left out.
      </p>
    </>
  );
}
