/**
 * Adds the followed account to a reason line, e.g. "owned by 5 of your top crate mates · you follow
 * Warp", since following it is part of why the row ranks where it does (decisions §16).
 */
export function withFollowed(reason: string, followed: string | null): string {
  return followed === null ? reason : `${reason} · you follow ${followed}`;
}
