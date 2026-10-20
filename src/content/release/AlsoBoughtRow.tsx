import type { AlsoBoughtRow as RowData } from '../../shared/alsoBought';
import {
  Badge,
  Button,
  Cover,
  EmbedFrame,
  ExternalIcon,
  HeartIcon,
  HideIcon,
  LinkButton,
  PlayIcon,
  Row,
  StopIcon,
  Tooltip,
} from '../../ui';
import { formatOwnedTracks, formatReason } from './formatReason';

export interface AlsoBoughtRowProps {
  row: RowData;
  previewing: boolean;
  onPreview: (open: boolean) => void;
  onHide: () => void;
}

export function AlsoBoughtRow({ row, previewing, onPreview, onHide }: AlsoBoughtRowProps) {
  const name = `${row.artist} – ${row.title}`;
  return (
    <Row
      media={<Cover src={row.coverUrl} />}
      title={
        <a href={row.url} title={name}>
          {row.title}
        </a>
      }
      meta={[row.label ? `${row.artist} · ${row.label}` : row.artist, formatReason(row.reason)]}
      badges={row.ownedTracks > 0 && <Badge>{formatOwnedTracks(row.ownedTracks)}</Badge>}
      actions={
        <>
          <Tooltip content={previewing ? 'Stop preview' : 'Preview'}>
            <Button
              variant="ghost"
              icon
              aria-label={`Preview ${name}`}
              aria-pressed={previewing}
              onClick={() => onPreview(!previewing)}
            >
              {previewing ? <StopIcon /> : <PlayIcon />}
            </Button>
          </Tooltip>
          {/* Wishlisting needs a logged-in API call we haven't captured (decisions §6). */}
          <Tooltip content="Open on Bandcamp to wishlist it">
            <LinkButton
              variant="ghost"
              icon
              href={row.url}
              target="_blank"
              rel="noopener"
              aria-label={`Wishlist ${name} on Bandcamp (opens in a new tab)`}
            >
              <HeartIcon />
            </LinkButton>
          </Tooltip>
          <Tooltip content="Open in a new tab">
            <LinkButton
              variant="ghost"
              icon
              href={row.url}
              target="_blank"
              rel="noopener"
              aria-label={`Open ${name} in a new tab`}
            >
              <ExternalIcon />
            </LinkButton>
          </Tooltip>
          <Tooltip content="Hide: never recommend this">
            <Button variant="ghost" icon aria-label={`Hide ${name}`} onClick={onHide}>
              <HideIcon />
            </Button>
          </Tooltip>
        </>
      }
    >
      {previewing && <EmbedFrame src={row.previewUrl} title={`Preview of ${name}`} />}
    </Row>
  );
}
