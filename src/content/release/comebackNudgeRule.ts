// When the collapsed sidebar may ask to be reopened (decisions §30).

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long the sidebar stays collapsed before a nudge, and the fixed gap between nudges. */
export const NUDGE_GAP_MS = 3 * DAY_MS;

/** Fewer picks than this aren't worth interrupting for. */
export const NUDGE_MIN_PICKS = 5;

export interface NudgeTimes {
  /** When the sidebar was last collapsed. Null while it's never been. */
  collapsedAt: number | null;
  /** When a nudge was last turned down with Not now. */
  lastNudgeAt: number | null;
}

export interface NudgeInput extends NudgeTimes {
  now: number;
  /** Also bought is past its warm-up, so the picks are trusted ones, not early ones. */
  trusted: boolean;
  picks: number;
}

export function shouldShowComebackNudge({
  now,
  collapsedAt,
  lastNudgeAt,
  trusted,
  picks,
}: NudgeInput): boolean {
  if (collapsedAt === null || now - collapsedAt < NUDGE_GAP_MS) return false;
  if (lastNudgeAt !== null && now - lastNudgeAt < NUDGE_GAP_MS) return false;
  return trusted && picks >= NUDGE_MIN_PICKS;
}
