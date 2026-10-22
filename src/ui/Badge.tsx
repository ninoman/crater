import type { ReactNode } from 'react';

/** A small pill tag, e.g. "you own 1 track". `title` is a native hover hint. */
export function Badge({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="dh-badge" title={title}>
      {children}
    </span>
  );
}
