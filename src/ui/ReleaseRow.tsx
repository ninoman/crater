import type { ReactNode } from 'react';
import { Button } from './Button';
import { CartButton, type CartButtonProps } from './CartButton';
import { HeardBadge } from './HeardBadge';
import { HeardIcon, CloseIcon } from './icons';
import { Menu, type MenuItem } from './Menu';
import { PlayableCover } from './PlayableCover';
import { Row } from './Row';
import { Tooltip } from './Tooltip';
import { WishlistButton, type WishlistButtonProps } from './WishlistButton';

/** What a recommended release row shows. Also-bought and For-you rows both fit it. */
export interface ReleaseRowRelease {
  title: string;
  artist: string;
  label: string | null;
  url: string;
  coverUrl: string | null;
}

/** How much a hide takes out: this release, everything by its artist, or on its label. */
export type HideScope = 'release' | 'band' | 'label';

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
  /** You've heard it: a badge and a dimmed cover. */
  heard: boolean;
  onHeardChange: (heard: boolean) => void;
  /** Names for the wider hides on offer, e.g. the artist's; null leaves that one out. */
  hideScopes: { band: string | null; label: string | null };
  onHide: (scope: HideScope) => void;
  /** The heart, and the tag picker it opened, if any. Left out, the row has no heart. */
  wishlist?: Pick<WishlistButtonProps, 'heart' | 'onToggle'> & { tagPicker: ReactNode };
  /** Adds the digital release to your cart, or takes it out. Left out, the row has none. */
  cart?: Pick<CartButtonProps, 'line' | 'onToggle'>;
}

/** A recommended release: playable cover, artist and label, reason, and wishlist / cart / heard / hide. */
export function ReleaseRow({
  release,
  reason,
  rank,
  status,
  extraActions,
  previewing,
  preview,
  onPreview,
  heard,
  onHeardChange,
  hideScopes,
  onHide,
  wishlist,
  cart,
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
            dimmed={heard}
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
      badges={heard && <HeardBadge />}
      actions={
        <>
          {wishlist && (
            <>
              <WishlistButton name={name} heart={wishlist.heart} onToggle={wishlist.onToggle} />
              {wishlist.tagPicker}
            </>
          )}
          {cart && <CartButton name={name} line={cart.line} onToggle={cart.onToggle} />}
          {extraActions}
          <Tooltip content={heard ? 'Mark as not heard' : 'Mark as heard'}>
            <Button
              variant="ghost"
              icon
              aria-label={`Heard ${name}`}
              aria-pressed={heard}
              onClick={() => onHeardChange(!heard)}
            >
              <HeardIcon />
            </Button>
          </Tooltip>
          <Menu
            title="Hide from recommendations"
            hint="Hide from recommendations"
            items={hideItems(hideScopes, onHide)}
            trigger={
              <Button variant="ghost" icon aria-label={`Hide ${name} from recommendations`}>
                <CloseIcon />
              </Button>
            }
          />
        </>
      }
    >
      {previewing && preview}
    </Row>
  );
}

function hideItems(
  scopes: ReleaseRowProps['hideScopes'],
  onHide: (scope: HideScope) => void,
): MenuItem[] {
  return [
    { label: 'This release', onSelect: () => onHide('release') },
    ...(scopes.band === null
      ? []
      : [{ label: `Everything by ${scopes.band}`, onSelect: () => onHide('band') }]),
    ...(scopes.label === null
      ? []
      : [{ label: `Everything on ${scopes.label}`, onSelect: () => onHide('label') }]),
  ];
}
