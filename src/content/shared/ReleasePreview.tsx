import { type PreviewPlayerView, usePreviewPlayer } from '../../hooks/usePreviewPlayer';
import { AudioPlayer, type AudioPlayerState } from '../../ui';

export interface ReleasePreviewProps {
  url: string;
  /** "Artist – Title", for screen readers. */
  name: string;
}

/** An open preview under a release row. Mount it only while previewing: it plays on mount. */
export function ReleasePreview({ url, name }: ReleasePreviewProps) {
  const { view, toggle, seek } = usePreviewPlayer(url);
  return <AudioPlayer state={playerState(view)} label={name} onToggle={toggle} onSeek={seek} />;
}

function playerState(view: PreviewPlayerView): AudioPlayerState {
  switch (view.state) {
    case 'loading':
      return { kind: 'loading' };
    case 'error':
      return { kind: 'error', message: view.error };
    case 'ready':
      return {
        kind: 'ready',
        title: view.track.title,
        playing: view.playing,
        position: view.position,
        duration: view.duration,
      };
  }
}
