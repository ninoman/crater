import type { AlsoBoughtWarmup } from '../../shared/alsoBought';

/** "12 of 20 supporters read · 3 of 5 strong picks": what the warm-up is waiting for. */
export function formatWarmup(warmup: AlsoBoughtWarmup): string {
  return [
    `${warmup.read} of ${warmup.readTarget} supporters read`,
    `${warmup.confident} of ${warmup.confidentTarget} strong picks`,
  ].join(' · ');
}

/** Both halves of the wait as one bar, so it only fills when both are met. */
export function warmupFill(warmup: AlsoBoughtWarmup): { value: number; max: number } {
  return {
    value: warmup.read + warmup.confident,
    max: warmup.readTarget + warmup.confidentTarget,
  };
}
