import { useQueueRelease } from '../../hooks/useQueueRelease';
import type { AlsoBoughtRow as RowData } from '../../shared/alsoBought';
import { Button, QueueIcon, ReleaseRow, type ReleaseRowProps, Tooltip } from '../../ui';
import { withFollowed } from '../shared/followedText';
import { formatQueueOutcome, formatReason } from './formatReason';

export type AlsoBoughtRowProps = { row: RowData } & Pick<
  ReleaseRowProps,
  'previewing' | 'preview' | 'onPreview' | 'heard' | 'onHeardChange' | 'hideScopes' | 'onHide'
>;

export function AlsoBoughtRow({ row, ...controls }: AlsoBoughtRowProps) {
  const name = `${row.artist} – ${row.title}`;
  const { queue, queueRelease } = useQueueRelease(row.matchKey, row.url);
  return (
    <ReleaseRow
      release={row}
      reason={withFollowed(formatReason(row.reason), row.followed)}
      status={formatQueueOutcome(queue)}
      extraActions={
        <Tooltip content="Scan this release's supporters">
          <Button
            variant="ghost"
            icon
            aria-label={`Scan supporters of ${name}`}
            disabled={queue.state === 'queueing'}
            onClick={() => void queueRelease()}
          >
            <QueueIcon />
          </Button>
        </Tooltip>
      }
      {...controls}
    />
  );
}
