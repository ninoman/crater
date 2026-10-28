import type { ReactNode } from 'react';

/** Pins its children to the bottom of the window across their container's width, stacked, so they stay in reach on a long list. */
export function Dock({ children }: { children: ReactNode }) {
  return <div className="dh-dock">{children}</div>;
}
