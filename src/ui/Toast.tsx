import type { ReactNode } from 'react';

export interface ToastProps {
  /** Shows a spinner before the text. */
  busy?: boolean;
  children: ReactNode;
}

/** A small status note pinned to the window's bottom-left, like Bandcamp's "saving collection order…". */
export function Toast({ busy = false, children }: ToastProps) {
  return (
    <div className="dh-toast" role="status">
      {busy && <span className="dh-toast__spinner" aria-hidden="true" />}
      {children}
    </div>
  );
}
