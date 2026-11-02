/**
 * Pauses Bandcamp's own player. It keeps its audio elements in the page, and its play button
 * follows their `pause` event. Ours aren't found: previews play in detached elements.
 */
export function pausePagePlayers(root: Document = document): void {
  for (const audio of root.querySelectorAll('audio')) {
    if (!audio.paused) audio.pause();
  }
}

/**
 * Calls back when Bandcamp's own player starts, and returns the unsubscribe. Media events don't
 * bubble, so it's caught on the way down. Ours never reach `document`: they're detached.
 */
export function onPagePlayerStart(callback: () => void, root: Document = document): () => void {
  const onPlay = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) callback();
  };
  root.addEventListener('play', onPlay, true);
  return () => root.removeEventListener('play', onPlay, true);
}
