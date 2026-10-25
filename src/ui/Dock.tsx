import type { ReactNode } from 'react';

/** Floats its children at the bottom of the window, stacked, so they stay in reach on a long list. */
export function Dock({ children }: { children: ReactNode }) {
  return <div className="dh-dock">{children}</div>;
}
