// Which seed fans are worth a full collection read (decisions §5): most fans on your releases'
// supporter lists share little else with you, and a full read costs ~8 requests.

import type { FanRecord } from '../../db';
import { FAN_FRESH_MS } from './freshness';

/** read: scan their collection. profile: read their profile page first. skip: not worth it. */
export type SeedScreen = 'read' | 'profile' | 'skip';

type Profile = Pick<FanRecord, 'inCommon' | 'profiledAt'>;

/** A profile read signed in within the last 30 days says they share too little with you. */
export function profileRulesOut(fan: Profile | undefined, cutoff: number, now: number): boolean {
  if (fan?.profiledAt === undefined || now - fan.profiledAt >= FAN_FRESH_MS) return false;
  return fan.inCommon != null && fan.inCommon < cutoff;
}

export interface SeedScreenInput {
  followed: boolean;
  /** Your releases they're known to own, from supporter lists: a floor on what they share. */
  shared: number;
  fan: Profile | undefined;
  cutoff: number;
  now: number;
}

/** Fans you follow and fans already known to clear the bar are read without the profile. */
export function screenSeedFan({ followed, shared, fan, cutoff, now }: SeedScreenInput): SeedScreen {
  if (followed || shared >= cutoff) return 'read';
  if (profileRulesOut(fan, cutoff, now)) return 'skip';
  const fresh = fan?.profiledAt !== undefined && now - fan.profiledAt < FAN_FRESH_MS;
  return fresh && fan?.inCommon != null ? 'read' : 'profile';
}
