import type { ReactNode } from 'react';

export interface NoticeProps {
  tone: 'warning' | 'error';
  children: ReactNode;
}

/** A one-line banner about the state of things, e.g. "queue paused", shown above content. */
export function Notice({ tone, children }: NoticeProps) {
  return (
    <div className={`dh-notice dh-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
