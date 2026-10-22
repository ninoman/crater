import { useState } from 'react';
import type { ItemKey } from '../../../bandcamp';
import type { ForYouMode, ForYouRow } from '../../../shared/forYou';
import { ReleaseRow, RowList } from '../../../ui';
import { ReleasePreview } from '../../shared/ReleasePreview';
import { formatPickReason } from './forYouText';

export interface ForYouListProps {
  rows: readonly ForYouRow[];
  mode: ForYouMode;
  /** When the list was loaded, for "latest 3 days ago". */
  now: number;
  onHide: (matchKey: ItemKey) => void;
}

/** The ranked picks, one preview open at a time. */
export function ForYouList({ rows, mode, now, onHide }: ForYouListProps) {
  const [previewing, setPreviewing] = useState<ItemKey | null>(null);

  return (
    <>
      <div className="dh-profile__list">
        <RowList label={mode === 'fresh' ? 'For you, fresh' : 'For you'}>
          {rows.map((row, i) => (
            <ReleaseRow
              key={row.matchKey}
              release={row}
              rank={i + 1}
              reason={formatPickReason(row, now)}
              previewing={previewing === row.matchKey}
              preview={<ReleasePreview url={row.url} name={`${row.artist} – ${row.title}`} />}
              onPreview={(open) => setPreviewing(open ? row.matchKey : null)}
              onHide={() => onHide(row.matchKey)}
            />
          ))}
        </RowList>
      </div>
      <p className="dh-profile__note">
        {mode === 'fresh'
          ? 'What the fans most in step with you lately bought in the last year, weighted by how in step each twin is, how recently they bought it and how rare it is.'
          : "Releases your closest twins own and you don't, weighted by how alike each twin is and how rare the release is."}{' '}
        Hidden, owned and wishlisted releases are left out.
      </p>
    </>
  );
}
