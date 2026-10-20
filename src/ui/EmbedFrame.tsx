export interface EmbedFrameProps {
  src: string;
  /** Names the frame for screen readers, e.g. "Preview of Promises". */
  title: string;
}

/** Bandcamp's small EmbeddedPlayer, full width. */
export function EmbedFrame({ src, title }: EmbedFrameProps) {
  return <iframe className="dh-embed" src={src} title={title} loading="lazy" />;
}
