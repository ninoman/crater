import type { ReactNode } from 'react';
import { Button, LinkButton } from './Button';
import { ExternalIcon, HideIcon } from './icons';
import { PlayableCover } from './PlayableCover';
import { Row } from './Row';
import { Tooltip } from './Tooltip';

/** What a recommended release row shows. Also-bought and For-you rows both fit it. */
export interface ReleaseRowRelease {
  title: string;
  artist: string;
  label: string | null;
  url: string;
  coverUrl: string | null;
}

export interface ReleaseRowProps {
  release: ReleaseRowRelease;
  /** Why it's recommended, e.g. "7 supporters have this so far". */
  reason: string;
  /** Place in a ranked list, shown before the cover. */
  rank?: number;
  /** A line under the reason, such as the outcome of an extra action. */
  status?: string | null;
  /** More action buttons, shown before Hide. */
  extraActions?: ReactNode;
  previewing: boolean;
  /** The player, shown under the row while previewing. */
  preview: ReactNode;
  onPreview: (open: boolean) => void;
  onHide: () => void;
}

/** A recommended release: playable cover, artist and label, reason, and open / hide. */
export function ReleaseRow({
  release,
  reason,
  rank,
  status,
  extraActions,
  previewing,
  preview,
  onPreview,
  onHide,
}: ReleaseRowProps) {
  const name = `${release.artist} – ${release.title}`;
  return (
    <Row
      media={
        <>
          {rank !== undefined && <span className="dh-release-row__rank">{rank}</span>}
          <PlayableCover
            src={release.coverUrl}
            playing={previewing}
            label={name}
            onToggle={() => onPreview(!previewing)}
          />
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
      actions={
        <>
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
      {previewing && preview}
    </Row>
  );
}
