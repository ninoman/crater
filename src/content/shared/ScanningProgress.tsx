import { useScanActivity } from '../../hooks/useScanActivity';
import { InlineProgress } from '../../ui';

/**
 * Next to a list that already has rows: how far the scan that adds to it has got. Each time
 * more fans are read, `onFansRead` fetches the list again, so new crate mates show up in place.
 */
export function ScanningProgress({ onFansRead }: { onFansRead: () => void }) {
  const activity = useScanActivity(onFansRead);

  if (!activity || activity.kind === 'idle') return null;
  const { scanned, total } = activity.releases;
  if (total === 0) return null;
  const counted = `${scanned} of ${total} releases`;
  const label =
    activity.kind === 'stopped' ? `Scanning paused at ${counted}` : `Scanned ${counted}`;
  return <InlineProgress label={label} value={scanned} max={total} />;
}
