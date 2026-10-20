import type { ReactNode } from 'react';

/** A small pill tag, e.g. "you own 1 track". */
export function Badge({ children }: { children: ReactNode }) {
  return <span className="dh-badge">{children}</span>;
}
