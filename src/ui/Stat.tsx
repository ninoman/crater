import type { ReactNode } from 'react';

export interface StatProps {
  value: ReactNode;
  label: ReactNode;
}

/** A number with a short label under it, e.g. "128 / items". */
export function Stat({ value, label }: StatProps) {
  return (
    <div className="dh-stat">
      <span className="dh-stat__value">{value}</span>
      <span className="dh-stat__label">{label}</span>
    </div>
  );
}
