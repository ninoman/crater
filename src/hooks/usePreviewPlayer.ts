import { useCallback, useEffect, useState } from 'react';
import type { PreviewTrack } from '../bandcamp';
import { sendMessage } from '../shared/messages';

export type PreviewPlayerView =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; track: PreviewTrack; playing: boolean; position: number; duration: number };

export interface PreviewPlayer {
  view: PreviewPlayerView;
  toggle: () => void;
  seek: (seconds: number) => void;
}

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; tracks: PreviewTrack[] };

/**
 * Plays a release's preview in our own audio element, so it starts on the click that opened it
 * and can be seeked. Starts at the featured track and moves on to the next when one ends.
 * Stops and lets go of the stream when the component unmounts.
 */
export function usePreviewPlayer(url: string): PreviewPlayer {
  const [audio] = useState(() => new Audio());
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ state: 'loading' });
    sendMessage('getPreview', { url }).then(
      ({ tracks, startIndex }) => {
        if (cancelled) return;
        if (tracks.length === 0) {
          setLoad({ state: 'error', error: 'No streamable tracks on this release.' });
          return;
        }
        setIndex(startIndex);
        setLoad({ state: 'ready', tracks });
      },
      (error: unknown) =>
        !cancelled &&
        setLoad({ state: 'error', error: `Couldn't load the preview: ${String(error)}` }),
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  const tracks = load.state === 'ready' ? load.tracks : null;
  const track = tracks?.[index] ?? null;

  useEffect(() => {
    const onTime = () => setPosition(audio.currentTime);
    const onDuration = () => setMediaDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setFailed(true);
    const onEnded = () => {
      if (tracks && index + 1 < tracks.length) setIndex(index + 1);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audio, tracks, index]);

  useEffect(() => {
    if (!track) return;
    setFailed(false);
    setPosition(0);
    setMediaDuration(0);
    audio.src = track.streamUrl;
    // The click that opened the preview counts as a user gesture, so this plays with sound.
    // A rejection (autoplay blocked, or a newer src) just leaves it paused for the Play button.
    audio.play().catch(() => undefined);
  }, [audio, track]);

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
