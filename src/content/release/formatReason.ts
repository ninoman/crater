import type { QueueReleaseState } from '../../hooks/useQueueRelease';
import type { AlsoBoughtReason } from '../../shared/alsoBought';

/**
 * The reason line under a recommendation, e.g. "7 supporters have this so far", plus how many
 * of them are your crate mates, since that's what lifted it in the ranking. "So far" because the
 * count grows as more supporters are scanned.
 */
export function formatReason(reason: AlsoBoughtReason): string {
  switch (reason.kind) {
    case 'co-owned': {
      const line = `${reason.owners} supporters have this so far`;
      if (reason.crateMates === 0) return line;
      return `${line}, ${reason.crateMates === 1 ? '1 is your crate mate' : `${reason.crateMates} are your crate mates`}`;
    }
    case 'same-artist':
      return 'More from this artist';
    case 'same-label':
      return reason.label ? `Also on ${reason.label}` : 'From the same label';
  }
}

export function formatOverlap(count: number): string {
  return `${count} release${count === 1 ? '' : 's'} in common with you`;
}

/** The line after a "scan supporters" click, or null before one. */
export function formatQueueOutcome(queue: QueueReleaseState): string | null {
  switch (queue.state) {
    case 'idle':
      return null;
    case 'queueing':
      return 'Queueing…';
    case 'error':
      return 'Could not queue it';
    case 'done':
      switch (queue.status) {
        case 'queued':
          return 'Queued for scanning';
        case 'already-queued':
          return 'Already queued';
        case 'fresh':
          return 'Scanned recently';
      }
  }
}
