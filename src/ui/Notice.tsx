import type { ReactNode } from 'react';

export interface NoticeProps {
  tone: 'warning' | 'error';
  /** A short lead-in, e.g. "Queue paused." */
  title?: ReactNode;
  children: ReactNode;
}

/** A banner about the state of things, e.g. "queue paused", shown above content. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div className={`dh-notice dh-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && (
        <>
          <strong className="dh-notice__title">{title}</strong>{' '}
        </>
      )}
      {children}
    </div>
  );
}

export interface NoticeItem {
  id: string;
  tone: NoticeProps['tone'];
  title: string;
  detail: string;
}

/** A column of notices. Renders nothing when there are none. */
export function NoticeStack({ notices }: { notices: readonly NoticeItem[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="dh-notice-stack">
      {notices.map(({ id, tone, title, detail }) => (
        <Notice key={id} tone={tone} title={title}>
          {detail}
        </Notice>
      ))}
    </div>
  );
}
