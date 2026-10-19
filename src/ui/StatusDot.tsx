import type { ReactNode } from 'react';

export interface StatusDotProps {
  tone: 'neutral' | 'ok' | 'warning' | 'error';
  children: ReactNode;
}

/** A coloured dot followed by a short status label. */
export function StatusDot({ tone, children }: StatusDotProps) {
  return (
    <span className={`dh-status dh-status--${tone}`}>
      <span className="dh-status__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
