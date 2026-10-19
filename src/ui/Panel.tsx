import type { ReactNode } from 'react';
import { cx } from './cx';

export interface PanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Controls shown at the right of the header, e.g. a collapse button. */
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, actions, footer, className, children }: PanelProps) {
  return (
    <section className={cx('dh-panel', className)}>
      <header className="dh-panel__header">
        <div className="dh-panel__heading">
          <h2 className="dh-panel__title">{title}</h2>
          {subtitle && <p className="dh-panel__subtitle">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="dh-panel__body">{children}</div>
      {footer && <footer className="dh-panel__footer">{footer}</footer>}
    </section>
  );
}
