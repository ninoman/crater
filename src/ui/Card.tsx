import type { ReactNode } from 'react';
import { TruncatedText } from './TruncatedText';

export function CardGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="dh-card-grid" aria-label={label}>
      {children}
    </ul>
  );
}

export interface CardProps {
  /** Square artwork filling the card's width. */
  media: ReactNode;
  /** Pinned to the artwork's top-left, e.g. a select box. */
  select?: ReactNode;
  /** Pinned to the artwork's top-right, shown on hover or focus. */
  actions?: ReactNode;
  title: ReactNode;
  /** Short lines under the title, e.g. artist and date added. */
  meta?: ReactNode[];
  /** Small tags after the meta lines. */
  badges?: ReactNode;
  /** Content under the card, e.g. an open preview player. */
  children?: ReactNode;
}

/** One item in a CardGrid: big artwork with its text underneath, like Bandcamp's own grids. */
export function Card({ media, select, actions, title, meta = [], badges, children }: CardProps) {
  return (
    <li className="dh-card">
      <div className="dh-card__media">
        {media}
        {select && <div className="dh-card__select">{select}</div>}
        {actions && <div className="dh-card__actions">{actions}</div>}
      </div>
      <span className="dh-card__title">{title}</span>
      {meta.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: meta lines are static and never reorder.
        <TruncatedText key={i} className="dh-card__meta">
          {line}
        </TruncatedText>
      ))}
      {badges && <span className="dh-card__badges">{badges}</span>}
      {children}
    </li>
  );
}
