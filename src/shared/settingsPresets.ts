// Friendly bundles of several raw settings, so the popup can offer one choice instead of three numbers.

import { DEFAULT_SETTINGS, type Settings } from './settings';

type SpeedSettings = Pick<Settings, 'paceMinMs' | 'paceMaxMs' | 'dailyRequestBudget'>;

export type SpeedPreset = 'gentle' | 'normal' | 'fast';

export const SPEED_PRESETS: Record<SpeedPreset, SpeedSettings> = {
  gentle: { paceMinMs: 3000, paceMaxMs: 6000, dailyRequestBudget: 3000 },
  // Normal is the defaults, so a fresh install and a reset both land on it.
  normal: {
    paceMinMs: DEFAULT_SETTINGS.paceMinMs,
    paceMaxMs: DEFAULT_SETTINGS.paceMaxMs,
    dailyRequestBudget: DEFAULT_SETTINGS.dailyRequestBudget,
  },
  fast: { paceMinMs: 1000, paceMaxMs: 2000, dailyRequestBudget: 20_000 },
};

/** Which preset the speed settings match, or 'custom' after hand edits. */
export function speedPresetOf(settings: Settings): SpeedPreset | 'custom' {
  const match = (Object.keys(SPEED_PRESETS) as SpeedPreset[]).find((preset) => {
    const values = SPEED_PRESETS[preset];
    return (Object.keys(values) as (keyof SpeedSettings)[]).every(
      (key) => settings[key] === values[key],
    );
  });
  return match ?? 'custom';
}

export function applySpeedPreset(settings: Settings, preset: SpeedPreset): Settings {
  return { ...settings, ...SPEED_PRESETS[preset] };
}
