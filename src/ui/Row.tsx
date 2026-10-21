import type { ReactNode } from 'react';
import { TruncatedText } from './TruncatedText';

export function RowList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="dh-row-list" aria-label={label}>
      {children}
    </ul>
  );
}

export interface RowProps {
  media?: ReactNode;
  title: ReactNode;
  /** Short lines under the title, e.g. artist and label, then a reason. */
  meta?: ReactNode[];
  /** Small tags after the meta lines. */
  badges?: ReactNode;
  /** Buttons shown at the right. */
  actions?: ReactNode;
  /** Content under the row, e.g. an open preview player. */
  children?: ReactNode;
}

/** One item in a RowList: artwork, text and actions. */
export function Row({ media, title, meta = [], badges, actions, children }: RowProps) {
  return (
    <li className="dh-row">
      <div className="dh-row__main">
        {media}
        <div className="dh-row__text">
          <span className="dh-row__title">{title}</span>
          {meta.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: meta lines are static and never reorder.
            <TruncatedText key={i} className="dh-row__meta">
              {line}
            </TruncatedText>
          ))}
          {badges && <span className="dh-row__badges">{badges}</span>}
        </div>
        {actions && <div className="dh-row__actions">{actions}</div>}
      </div>
      {children}
    </li>
  );
}
