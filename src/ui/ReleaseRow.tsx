import type { ReactNode } from 'react';
import { Button, LinkButton } from './Button';
import { Cover } from './Cover';
import { EmbedFrame } from './EmbedFrame';
import { ExternalIcon, HeartIcon, HideIcon, PlayIcon, StopIcon } from './icons';
import { Row } from './Row';
import { Tooltip } from './Tooltip';

/** What a recommended release row shows. Also-bought and For-you rows both fit it. */
export interface ReleaseRowRelease {
  title: string;
  artist: string;
  label: string | null;
  url: string;
  coverUrl: string | null;
  previewUrl: string;
}

export interface ReleaseRowProps {
  release: ReleaseRowRelease;
  /** Why it's recommended, e.g. "7 of 48 supporters own this". */
  reason: string;
  /** Place in a ranked list, shown before the cover. */
  rank?: number;
  badges?: ReactNode;
  /** A line under the reason, such as the outcome of an extra action. */
  status?: string | null;
  /** More action buttons, shown before Hide. */
  extraActions?: ReactNode;
  previewing: boolean;
  onPreview: (open: boolean) => void;
  onHide: () => void;
}

/** A recommended release: cover, artist and label, reason, and preview / wishlist / open / hide. */
export function ReleaseRow({
  release,
  reason,
  rank,
  badges,
  status,
  extraActions,
  previewing,
  onPreview,
  onHide,
}: ReleaseRowProps) {
  const name = `${release.artist} – ${release.title}`;
  return (
    <Row
      media={
        <>
          {rank !== undefined && <span className="dh-release-row__rank">{rank}</span>}
          <Cover src={release.coverUrl} />
        </>
      }
      title={
        <a href={release.url} title={name}>
          {release.title}
        </a>
      }
      meta={[
        release.label ? `${release.artist} · ${release.label}` : release.artist,
        reason,
        ...(status ? [status] : []),
      ]}
      badges={badges}
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
              href={release.url}
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
              href={release.url}
              target="_blank"
              rel="noopener"
              aria-label={`Open ${name} in a new tab`}
            >
              <ExternalIcon />
            </LinkButton>
          </Tooltip>
          {extraActions}
          <Tooltip content="Hide: never recommend this">
            <Button variant="ghost" icon aria-label={`Hide ${name}`} onClick={onHide}>
              <HideIcon />
            </Button>
          </Tooltip>
        </>
      }
    >
      {previewing && <EmbedFrame src={release.previewUrl} title={`Preview of ${name}`} />}
    </Row>
  );
}
