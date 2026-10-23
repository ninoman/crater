import { useEffect, useRef } from 'react';
import { Button } from './Button';

export interface LoadMoreProps {
  /** How many rows are still hidden. Renders nothing at 0. */
  remaining: number;
  onMore: () => void;
}

/** How far below the window the button starts loading, so rows are there before you reach it. */
const AHEAD = '800px';

/**
 * "Show more" under a long list. It also fires by itself as it scrolls near the window, so the
 * list grows as you scroll; the button is there for keyboards and when that can't run.
 */
export function LoadMore({ remaining, onMore }: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onMoreRef = useRef(onMore);
  onMoreRef.current = onMore;

  useEffect(() => {
    const area = ref.current;
    if (!area || remaining === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onMoreRef.current();
      },
      { rootMargin: AHEAD },
    );
    observer.observe(area);
    return () => observer.disconnect();
  }, [remaining]);

  if (remaining === 0) return null;
  return (
    <div ref={ref} className="dh-load-more">
      <Button onClick={onMore}>Show more ({remaining} left)</Button>
    </div>
  );
}
