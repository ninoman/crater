import type { ReactNode } from 'react';
import { InfoIcon } from './icons';
import { Tooltip } from './Tooltip';

export interface InfoHintProps {
  /** Names the button for screen readers, e.g. "How score works". */
  label: string;
  children: ReactNode;
}

/** An ⓘ button that explains the thing next to it on hover or focus. */
export function InfoHint({ label, children }: InfoHintProps) {
  return (
    <Tooltip content={children}>
      <button type="button" className="dh-info-hint" aria-label={label}>
        <InfoIcon />
      </button>
    </Tooltip>
  );
}
