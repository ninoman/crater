import { cx } from './cx';

export interface CoverProps {
  src: string | null;
  /** `fill` stretches to the container's width, for grids. */
  size?: 'sm' | 'fill';
  /** Faded, e.g. for a release you've heard. Full again on hover or focus of a PlayableCover. */
  dimmed?: boolean;
}

/** Release artwork as a square. Decorative: the title next to it names the release. */
export function Cover({ src, size = 'sm', dimmed = false }: CoverProps) {
  const className = cx(
    'dh-cover',
    size === 'fill' && 'dh-cover--fill',
    dimmed && 'dh-cover--dimmed',
  );
  return src ? (
    <img className={className} src={src} alt="" loading="lazy" />
  ) : (
    <span className={cx(className, 'dh-cover--empty')} aria-hidden="true" />
  );
}
