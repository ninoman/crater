import type { ReactNode, Ref } from 'react';
import { cx } from './cx';
import { TruncatedText } from './TruncatedText';

export function CardGrid({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul className={cx('dh-card-grid', className)} aria-label={label}>
      {children}
    </ul>
  );
}

/**
 * Where a card is in a drag: the gap it leaves behind under the pointer, picked up from the
 * keyboard, or the copy that follows the pointer.
 */
export type CardDragState = 'placeholder' | 'lifted' | 'overlay';

export interface CardProps {
  /** Square artwork filling the card's width. */
  media: ReactNode;
  /** Pinned to the artwork's top-left, e.g. a select box. */
  select?: ReactNode;
  /** A drag handle, pinned to the artwork's top-right. */
  handle?: ReactNode;
  dragState?: CardDragState;
  ref?: Ref<HTMLLIElement>;
  title: ReactNode;
  /** Short lines under the title, e.g. artist and date added. */
  meta?: ReactNode[];
  /** Small tags after the meta lines. */
  badges?: ReactNode;
}

/** One item in a CardGrid: big artwork with its text underneath, like Bandcamp's own grids. */
export function Card({
  media,
  select,
  handle,
  dragState,
  ref,
  title,
  meta = [],
  badges,
}: CardProps) {
  return (
    <li
      ref={ref}
      className={cx(
        'dh-card',
        handle !== undefined && 'dh-card--sortable',
        dragState && `dh-card--${dragState}`,
      )}
    >
      <div className="dh-card__media">
        {media}
        {select && <div className="dh-card__select">{select}</div>}
        {handle}
      </div>
      <span className="dh-card__title">{title}</span>
      {meta.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: meta lines are static and never reorder.
        <TruncatedText key={i} className="dh-card__meta">
          {line}
        </TruncatedText>
      ))}
      {badges && <span className="dh-card__badges">{badges}</span>}
    </li>
  );
}
