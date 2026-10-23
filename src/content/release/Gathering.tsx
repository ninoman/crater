import type { ReactNode } from 'react';
import { SkeletonRows } from '../../ui';

export interface GatheringProps {
  title: string;
  description?: string;
  /** The wait isn't moving, e.g. the scanner is stopped: the placeholders hold still. */
  paused?: boolean;
  /** Off once real rows show below, so only the status line stays. */
  placeholders?: boolean;
  /** Extra detail under the description, such as a progress bar. */
  children?: ReactNode;
}

/** What Also bought is waiting for, over placeholder rows until there's something to show. */
export function Gathering({
  title,
  description,
  paused = false,
  placeholders = true,
  children,
}: GatheringProps) {
  return (
    <div role="status" aria-busy={!paused}>
      <div className="dh-warmup">
        <p className="dh-warmup__title">{title}</p>
        {description && <p className="dh-warmup__line">{description}</p>}
        {children}
      </div>
      {placeholders && <SkeletonRows count={4} paused={paused} />}
    </div>
  );
}
