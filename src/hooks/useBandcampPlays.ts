import { useEffect } from 'react';
import type { ItemKey } from '../bandcamp';
import {
  isHeard,
  type Listening,
  listenedTo,
  NOT_LISTENING,
  stoppedListening,
} from '../shared/heard';
import { sendMessage } from '../shared/messages';

/**
 * Marks the release page's release heard once Bandcamp's own player has played it past the
 * threshold (decisions §22). Media events don't bubble, so they're caught on the way down, on
 * `document`. Our own players never reach it: the preview's audio element isn't in the page,
 * and events inside our shadow roots aren't composed.
 */
export function useBandcampPlays(itemKey: ItemKey, root: Document = document): void {
  useEffect(() => {
    let listening: Listening = NOT_LISTENING;
    let marked = false;

    const audioOf = (event: Event) =>
      event.target instanceof HTMLMediaElement ? event.target : null;
    const markIfHeard = (endedTrackSeconds?: number) => {
      if (marked || !isHeard(listening, endedTrackSeconds)) return;
      marked = true;
      sendMessage('markHeard', { itemKey, source: 'bandcamp' }).catch((error: unknown) =>
        console.warn('dighead: could not save a heard mark', error),
      );
    };
    const onTime = (event: Event) => {
      const audio = audioOf(event);
      if (!audio || audio.paused) return;
      listening = listenedTo(listening, audio.currentTime);
      markIfHeard();
    };
    // Pausing, seeking and a new track all start a fresh step.
    const onBreak = (event: Event) => {
      if (audioOf(event)) listening = stoppedListening(listening);
    };
    const onEnded = (event: Event) => {
      const audio = audioOf(event);
      if (!audio) return;
      markIfHeard(Number.isFinite(audio.duration) ? audio.duration : undefined);
      listening = stoppedListening(listening);
    };

    const breaks = ['pause', 'seeking', 'emptied'] as const;
    root.addEventListener('timeupdate', onTime, true);
    for (const type of breaks) root.addEventListener(type, onBreak, true);
    root.addEventListener('ended', onEnded, true);
    return () => {
      root.removeEventListener('timeupdate', onTime, true);
      for (const type of breaks) root.removeEventListener(type, onBreak, true);
      root.removeEventListener('ended', onEnded, true);
    };
  }, [itemKey, root]);
}
