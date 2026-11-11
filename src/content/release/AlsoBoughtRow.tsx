import type { AlsoBoughtRow as RowData } from '../../shared/alsoBought';
import { ReleaseRow, type ReleaseRowProps } from '../../ui';
import { withFollowed } from '../shared/followedText';
import { formatReason } from './formatReason';

export type AlsoBoughtRowProps = { row: RowData } & Pick<
  ReleaseRowProps,
  | 'previewing'
  | 'preview'
  | 'onPreview'
  | 'heard'
  | 'onHeardChange'
  | 'hideScopes'
  | 'onHide'
  | 'wishlist'
  | 'cart'
>;

export function AlsoBoughtRow({ row, ...controls }: AlsoBoughtRowProps) {
  return (
    <ReleaseRow
      release={row}
      reason={withFollowed(formatReason(row.reason), row.followed)}
      {...controls}
    />
  );
}
