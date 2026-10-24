import { HeardIcon } from './icons';

/** Marks a release you've listened to (decisions §22). Pair it with a dimmed cover. */
export function HeardBadge() {
  return (
    <span className="dh-badge dh-heard-badge" title="You've listened to this">
      <HeardIcon />
      Heard
    </span>
  );
}
