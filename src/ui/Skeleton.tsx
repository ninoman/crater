import { cx } from './cx';

export interface SkeletonRowsProps {
  count: number;
  /** Still, for a wait that isn't moving (e.g. the scanner is stopped). */
  paused?: boolean;
}

/** Placeholder rows shaped like a RowList, while its content is on the way. */
export function SkeletonRows({ count, paused = false }: SkeletonRowsProps) {
  return (
    <ul className={cx('dh-skeleton', paused && 'dh-skeleton--paused')} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity.
        <li key={i} className="dh-skeleton__row">
          <span className="dh-skeleton__block dh-skeleton__cover" />
          <span className="dh-skeleton__text">
            <span className="dh-skeleton__block dh-skeleton__line" />
            <span className="dh-skeleton__block dh-skeleton__line dh-skeleton__line--short" />
          </span>
        </li>
      ))}
    </ul>
  );
}
