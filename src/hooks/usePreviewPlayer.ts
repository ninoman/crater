import { useCallback, useEffect, useRef, useState } from 'react';
import { type ItemKey, onPagePlayerStart, pausePagePlayers, type PreviewTrack } from '../bandcamp';
import {
  isHeard,
  type Listening,
  listenedTo,
  NOT_LISTENING,
  stoppedListening,
} from '../shared/heard';
import { sendMessage } from '../shared/messages';

export type PreviewPlayerView =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; track: PreviewTrack; playing: boolean; position: number; duration: number };

export interface PreviewPlayer {
  view: PreviewPlayerView;
  toggle: () => void;
  seek: (seconds: number) => void;
}

export interface PreviewPlayerOptions {
  /** The release's last track finished. */
  onEnded?: () => void;
  /** A play passed the heard threshold. The mark itself is already sent to the worker. */
  onHeard?: (matchKey: ItemKey) => void;
}

type Load =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; tracks: PreviewTrack[]; matchKey: ItemKey | null };

/**
 * Plays a release's preview in our own audio element, so it starts on the click that opened it
 * and can be seeked. Starts at the featured track and moves on to the next when one ends. A
 * null `url` is stopped; a new one switches release in the same element. Listening past the
 * heard threshold marks the release heard (decisions §22). Playing pauses Bandcamp's own player,
 * and it starting pauses this one. Stops and lets go of the stream when the component unmounts.
 */
export function usePreviewPlayer(
  url: string | null,
  { onEnded, onHeard }: PreviewPlayerOptions = {},
): PreviewPlayer {
  const [audio] = useState(() => new Audio());
  const [load, setLoad] = useState<Load>({ state: 'idle' });
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  // Read from media events, so they mustn't re-subscribe them on every render.
  const callbacks = useRef({ onEnded, onHeard });
  useEffect(() => {
    callbacks.current = { onEnded, onHeard };
  });
  const listening = useRef<Listening>(NOT_LISTENING);
  const heard = useRef(false);

  useEffect(() => {
    // A new release starts from silence, whatever the last one was doing.
    audio.pause();
    listening.current = NOT_LISTENING;
    heard.current = false;
    if (url === null) {
      setLoad({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setLoad({ state: 'loading' });
    sendMessage('getPreview', { url }).then(
      ({ tracks, startIndex, matchKey }) => {
        if (cancelled) return;
        if (tracks.length === 0) {
          setLoad({ state: 'error', error: 'No streamable tracks on this release.' });
          return;
        }
        setIndex(startIndex);
        setLoad({ state: 'ready', tracks, matchKey });
      },
      (error: unknown) =>
        !cancelled &&
        setLoad({ state: 'error', error: `Couldn't load the preview: ${String(error)}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [audio, url]);

  const tracks = load.state === 'ready' ? load.tracks : null;
  const matchKey = load.state === 'ready' ? load.matchKey : null;
  const track = tracks?.[index] ?? null;

  useEffect(() => {
    const markIfHeard = (endedTrackSeconds?: number) => {
      if (heard.current || matchKey === null) return;
      if (!isHeard(listening.current, endedTrackSeconds)) return;
      heard.current = true;
      sendMessage('markHeard', { itemKey: matchKey, source: 'preview' }).catch((error: unknown) =>
        console.warn('crater: could not save a heard mark', error),
      );
      callbacks.current.onHeard?.(matchKey);
    };
    const onTime = () => {
      setPosition(audio.currentTime);
      if (!audio.paused) listening.current = listenedTo(listening.current, audio.currentTime);
      markIfHeard();
    };
    const onDuration = () => setMediaDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      // On every play, not just on opening: resuming a preview mustn't talk over Bandcamp either.
      pausePagePlayers();
    };
    const onPause = () => {
      setPlaying(false);
      listening.current = stoppedListening(listening.current);
    };
    const onSeeking = () => {
      listening.current = stoppedListening(listening.current);
    };
    const onError = () => setFailed(true);
    const onTrackEnded = () => {
      markIfHeard(Number.isFinite(audio.duration) ? audio.duration : undefined);
      listening.current = stoppedListening(listening.current);
      if (tracks && index + 1 < tracks.length) setIndex(index + 1);
      else callbacks.current.onEnded?.();
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onTrackEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onTrackEnded);
    };
  }, [audio, tracks, index, matchKey]);

  useEffect(() => {
    if (!track) return;
    setFailed(false);
    setPosition(0);
    setMediaDuration(0);
    audio.src = track.streamUrl;
    // The click that opened the preview counts as a user gesture, so this plays with sound,
    // and so does moving on through a list after it. A rejection (autoplay blocked, or a newer
    // src) just leaves it paused for the Play button.
    audio.play().catch(() => undefined);
  }, [audio, track]);

  useEffect(() => onPagePlayerStart(() => audio.pause()), [audio]);

  useEffect(
    () => () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
    [audio],
  );

  const toggle = useCallback(() => {
    if (audio.paused) audio.play().catch(() => undefined);
    else audio.pause();
  }, [audio]);

  const seek = useCallback(
    (seconds: number) => {
      audio.currentTime = seconds;
      setPosition(seconds);
    },
    [audio],
  );

  let view: PreviewPlayerView;
  if (load.state !== 'ready') view = load;
  else if (failed || !track)
    view = { state: 'error', error: "Bandcamp wouldn't stream this track." };
  else {
    view = {
      state: 'ready',
      track,
      playing,
      position,
      duration: mediaDuration || track.duration,
    };
  }
  return { view, toggle, seek };
}
