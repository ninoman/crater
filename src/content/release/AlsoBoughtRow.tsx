import { useQueueRelease } from '../../hooks/useQueueRelease';
import type { AlsoBoughtRow as RowData } from '../../shared/alsoBought';
import { Badge, Button, QueueIcon, ReleaseRow, Tooltip } from '../../ui';
import { formatOwnedTracks } from '../shared/formatOwnedTracks';
import { ReleasePreview } from '../shared/ReleasePreview';
import { formatQueueOutcome, formatReason } from './formatReason';

export interface AlsoBoughtRowProps {
  row: RowData;
  previewing: boolean;
  onPreview: (open: boolean) => void;
  onHide: () => void;
}

export function AlsoBoughtRow({ row, ...actions }: AlsoBoughtRowProps) {
  const name = `${row.artist} – ${row.title}`;
  const { queue, queueRelease } = useQueueRelease(row.matchKey, row.url);
  return (
    <ReleaseRow
      release={row}
      reason={formatReason(row.reason)}
      status={formatQueueOutcome(queue)}
      preview={<ReleasePreview url={row.url} name={name} />}
      badges={row.ownedTracks > 0 && <Badge>{formatOwnedTracks(row.ownedTracks)}</Badge>}
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
      {...actions}
    />
  );
}
