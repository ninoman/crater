import type { AlsoBoughtRow as RowData } from '../../shared/alsoBought';
import { Badge, ReleaseRow } from '../../ui';
import { formatOwnedTracks } from '../shared/formatOwnedTracks';
import { formatReason } from './formatReason';

export interface AlsoBoughtRowProps {
  row: RowData;
  previewing: boolean;
  onPreview: (open: boolean) => void;
  onHide: () => void;
}

export function AlsoBoughtRow({ row, ...actions }: AlsoBoughtRowProps) {
  return (
    <ReleaseRow
      release={row}
      reason={formatReason(row.reason)}
      badges={row.ownedTracks > 0 && <Badge>{formatOwnedTracks(row.ownedTracks)}</Badge>}
      {...actions}
    />
  );
}
