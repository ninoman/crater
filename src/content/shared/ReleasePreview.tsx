import { type PreviewPlayerView, usePreviewPlayer } from '../../hooks/usePreviewPlayer';
import type { CartLines } from '../../hooks/useCartLines';
import type { WishlistHearts } from '../../hooks/useWishlistHearts';
import { AudioPlayer, type AudioPlayerState } from '../../ui';
import { PlayerActions, type PlayingRelease } from './PlayerActions';

export interface ReleasePreviewProps {
  url: string;
  /** "Artist – Title", for screen readers. */
  name: string;
  /** Listening passed the heard threshold; the mark itself is already saved. */
  onHeard?: () => void;
  /** Gives the player a heart and a cart button, beside the track title. */
  shop?: { release: PlayingRelease; hearts: WishlistHearts; cart: CartLines };
}

/** An open preview under a release row. Mount it only while previewing: it plays on mount. */
export function ReleasePreview({ url, name, onHeard, shop }: ReleasePreviewProps) {
  const { view, toggle, seek, previousTrack, nextTrack } = usePreviewPlayer(url, { onHeard });
  return (
    <AudioPlayer
      state={previewPlayerState(view)}
      label={name}
      onToggle={toggle}
      onSeek={seek}
      onPreviousTrack={previousTrack}
      onNextTrack={nextTrack}
      actions={shop && <PlayerActions view={view} releaseHeart {...shop} />}
    />
  );
}

/** The player's view as AudioPlayer draws it. Idle shows as loading: it's about to start. */
export function previewPlayerState(view: PreviewPlayerView): AudioPlayerState {
  switch (view.state) {
    case 'idle':
    case 'loading':
      return { kind: 'loading' };
    case 'error':
      return { kind: 'error', message: view.error };
    case 'ready':
      return {
        kind: 'ready',
        title: view.track.title,
        trackIndex: view.trackIndex,
        trackCount: view.trackCount,
        playing: view.playing,
        position: view.position,
        duration: view.duration,
      };
  }
}
