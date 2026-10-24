import type { ReactNode } from 'react';

/** A row of controls above a list, e.g. play-through and filters. Wraps when narrow. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="dh-toolbar">{children}</div>;
}
