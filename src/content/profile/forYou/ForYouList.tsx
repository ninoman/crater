import { useState } from 'react';
import type { ItemKey } from '../../../bandcamp';
import type { ForYouResult } from '../../../shared/forYou';
import { Badge, Notice, ReleaseRow, RowList } from '../../../ui';
import { formatOwnedTracks } from '../../shared/formatOwnedTracks';
import { formatForYouSummary, formatTwinOwners } from './forYouText';

export interface ForYouListProps {
  result: ForYouResult;
  parserBroken: boolean;
  onHide: (matchKey: ItemKey) => void;
}

/** The ranked picks, one preview open at a time. */
export function ForYouList({ result, parserBroken, onHide }: ForYouListProps) {
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {formatForYouSummary(result.rows.length, result.twinsUsed)}
        </p>
      </div>
      {parserBroken && (
        <div className="dh-profile__notice">
          <Notice tone="error">
            Parser broken: Bandcamp changed something Dighead reads, so these won&apos;t update
            until Dighead is updated.
          </Notice>
        </div>
      )}
      <div className="dh-profile__list">
        <RowList label="For you">
          {result.rows.map((row, i) => (
            <ReleaseRow
              key={row.matchKey}
              release={row}
              rank={i + 1}
              reason={formatTwinOwners(row.twins)}
              badges={row.ownedTracks > 0 && <Badge>{formatOwnedTracks(row.ownedTracks)}</Badge>}
              previewing={previewing === row.matchKey}
              onPreview={(open) => setPreviewing(open ? row.matchKey : null)}
              onHide={() => onHide(row.matchKey)}
            />
          ))}
        </RowList>
      </div>
      <p className="dh-profile__note">
        Releases your closest twins own and you don&apos;t, weighted by how alike each twin is and
        how rare the release is. Hidden, owned and wishlisted releases are left out.
      </p>
    </>
  );
}
