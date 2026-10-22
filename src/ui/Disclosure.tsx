import type { ReactNode } from 'react';

export interface DisclosureProps {
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** A section that folds away, e.g. advanced settings. Native <details>, so keyboard and screen readers work. */
export function Disclosure({ summary, open, onOpenChange, children }: DisclosureProps) {
  return (
    <details
      className="dh-disclosure"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="dh-disclosure__summary">{summary}</summary>
      <div className="dh-disclosure__body">{children}</div>
    </details>
  );
}
