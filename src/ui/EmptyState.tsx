import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  tone?: 'neutral' | 'error';
  action?: ReactNode;
}

/** The "nothing here (yet)" and "something went wrong" states of a view. */
export function EmptyState({ title, description, tone = 'neutral', action }: EmptyStateProps) {
  return (
    <div
      className={cx('dh-empty', tone === 'error' && 'dh-empty--error')}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <p className="dh-empty__title">{title}</p>
      {description && <p className="dh-empty__description">{description}</p>}
      {action}
    </div>
  );
}
