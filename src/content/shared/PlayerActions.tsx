// The heart and cart beside a player's track title. The heart wishlists the playing track, or the
// release when it has only one; the cart takes the digital release.

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
  /** Left out where the row under the player has the release's own cart button. */
  cart?: CartLines;
  /** False where that row has the release's heart, so only a track gets one here. */
  releaseHeart: boolean;
}

function heartTarget(view: PreviewPlayerView, release: PlayingRelease, releaseHeart: boolean) {
  if (view.state !== 'ready') return null;
  const trackKey = view.track.itemKey;
  if (view.trackCount > 1 && trackKey !== null) {
    return {
      release: { itemKey: trackKey, albumKey: release.matchKey },
      name: `${release.artist} – ${view.track.title}`,
    };
  }
  if (!releaseHeart) return null;
  return {
    release: { itemKey: release.matchKey, albumKey: null },
    name: `${release.artist} – ${release.title}`,
  };
}

export function PlayerActions({ view, release, hearts, cart, releaseHeart }: PlayerActionsProps) {
  const target = heartTarget(view, release, releaseHeart);
  const releaseName = `${release.artist} – ${release.title}`;
  return (
    <>
      {target && (
        <WishlistButton
          name={target.name}
          heart={hearts.heart(target.release.itemKey)}
          onToggle={(anchor) =>
            hearts.toggle({ ...target, rowKey: release.matchKey, url: release.url }, anchor)
          }
        />
      )}
      {cart && (
        <CartButton
          name={releaseName}
          line={cart.line(release.matchKey)}
          onToggle={() => cart.toggle(release.matchKey, release.url)}
        />
      )}
    </>
  );
}
