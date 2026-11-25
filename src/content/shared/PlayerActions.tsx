// The heart and cart beside a player's track title. They take the playing track, or the release
// when it has only one.

import type { ItemKey } from '../../bandcamp';
import type { CartLines } from '../../hooks/useCartLines';
import type { PreviewPlayerView } from '../../hooks/usePreviewPlayer';
import type { WishlistHearts } from '../../hooks/useWishlistHearts';
import { CartButton, WishlistButton } from '../../ui';

export interface PlayingRelease {
  /** The release's matchKey: an album, or a standalone track. */
  matchKey: ItemKey;
  url: string;
  artist: string;
  title: string;
}

export interface PlayerActionsProps {
  view: PreviewPlayerView;
  release: PlayingRelease;
  hearts: WishlistHearts;
  cart: CartLines;
  /** False where the row by the player has the release's heart and cart, so only a track gets them. */
  forRelease: boolean;
}

function target(view: PreviewPlayerView, release: PlayingRelease, forRelease: boolean) {
  if (view.state !== 'ready') return null;
  const trackKey = view.track.itemKey;
  if (view.trackCount > 1 && trackKey !== null) {
    return {
      release: { itemKey: trackKey, albumKey: release.matchKey },
      name: `${release.artist} – ${view.track.title}`,
    };
  }
  if (!forRelease) return null;
  return {
    release: { itemKey: release.matchKey, albumKey: null },
    name: `${release.artist} – ${release.title}`,
  };
}

export function PlayerActions({ view, release, hearts, cart, forRelease }: PlayerActionsProps) {
  const item = target(view, release, forRelease);
  if (!item) return null;
  const { itemKey } = item.release;
  return (
    <>
      <WishlistButton
        name={item.name}
        heart={hearts.heart(itemKey)}
        onToggle={(anchor) =>
          hearts.toggle({ ...item, rowKey: release.matchKey, url: release.url }, anchor)
        }
      />
      {/* The album's page leads the worker to the track's. */}
      <CartButton
        name={item.name}
        line={cart.line(itemKey)}
        onToggle={() => cart.toggle(itemKey, release.url)}
      />
    </>
  );
}
