import type { ReactNode } from 'react';
import { Button } from './Button';

export interface NoticeAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface NoticeProps {
  tone: 'warning' | 'error';
  /** A short lead-in, e.g. "Queue paused." */
  title?: ReactNode;
  children: ReactNode;
  /** What you can do about it, right here. */
  action?: NoticeAction;
}

/** A banner about the state of things, e.g. "queue paused", shown above content. */
export function Notice({ tone, title, children, action }: NoticeProps) {
  return (
    <div className={`dh-notice dh-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && (
        <>
          <strong className="dh-notice__title">{title}</strong>{' '}
        </>
      )}
      {children}
      {action && (
        <div className="dh-notice__action">
          <Button onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface NoticeItem {
  id: string;
  tone: NoticeProps['tone'];
  title: string;
  detail: string;
  action?: NoticeAction;
}

/** A column of notices. Renders nothing when there are none. */
export function NoticeStack({ notices }: { notices: readonly NoticeItem[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="dh-notice-stack">
      {notices.map(({ id, tone, title, detail, action }) => (
        <Notice key={id} tone={tone} title={title} action={action}>
          {detail}
        </Notice>
      ))}
    </div>
  );
}
