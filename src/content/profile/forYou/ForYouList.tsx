import { useState } from 'react';
import type { ItemKey } from '../../../bandcamp';
import type { ForYouResult } from '../../../shared/forYou';
import { ReleaseRow, RowList } from '../../../ui';
import { ReleasePreview } from '../../shared/ReleasePreview';
import { formatForYouSummary, formatTwinOwners } from './forYouText';

export interface ForYouListProps {
  result: ForYouResult;
  onHide: (matchKey: ItemKey) => void;
}

/** The ranked picks, one preview open at a time. */
export function ForYouList({ result, onHide }: ForYouListProps) {
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);

  return (
    <>
      <div className="dh-profile__toolbar">
        <p className="dh-profile__summary">
          {formatForYouSummary(result.rows.length, result.twinsUsed)}
        </p>
      </div>
      <div className="dh-profile__list">
        <RowList label="For you">
          {result.rows.map((row, i) => (
            <ReleaseRow
              key={row.matchKey}
              release={row}
              rank={i + 1}
              reason={formatTwinOwners(row.twins)}
              previewing={previewing === row.matchKey}
              preview={<ReleasePreview url={row.url} name={`${row.artist} – ${row.title}`} />}
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
