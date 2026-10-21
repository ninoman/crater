import type { ReactNode } from 'react';

/** A small heading over a group of rows, e.g. picks shown while something else loads. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="dh-section-heading">{children}</h3>;
}
