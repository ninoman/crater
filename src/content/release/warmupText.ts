import type { AlsoBoughtWarmup } from '../../shared/alsoBought';

/**
 * "3 of 5 strong picks · needs 20 supporters read": what the warm-up is waiting for. The scan
 * header counts supporters, so the target only shows when it stops short of that bar's end.
 */
export function formatWarmup(warmup: AlsoBoughtWarmup, scanTotal: number | null): string {
  const picks = `${warmup.confident} of ${warmup.confidentTarget} strong picks`;
  const short = warmup.read < warmup.readTarget && scanTotal !== null;
  if (!short || warmup.readTarget >= scanTotal) return picks;
  return `${picks} · needs ${warmup.readTarget} supporters read`;
}
