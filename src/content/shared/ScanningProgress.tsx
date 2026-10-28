import type { ScanActivity } from '../../shared/scanActivity';
import { InlineProgress } from '../../ui';

/** Next to a list that already has rows: how far the scan that adds to it has got. */
export function ScanningProgress({ activity }: { activity: ScanActivity | null }) {
  if (!activity || activity.kind === 'idle') return null;
  const { scanned, total } = activity.releases;
  if (total === 0) return null;
  const counted = `${scanned} of ${total} releases`;
  const label =
    activity.kind === 'stopped' ? `Scanning paused at ${counted}` : `Scanned ${counted}`;
  return <InlineProgress label={label} value={scanned} max={total} />;
}
