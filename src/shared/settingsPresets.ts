// Friendly bundles of several raw settings, so the popup can offer one choice instead of three numbers.

import { DEFAULT_SETTINGS, type Settings } from './settings';

type SpeedSettings = Pick<Settings, 'paceMinMs' | 'paceMaxMs' | 'dailyRequestBudget'>;

export type SpeedPreset = 'normal' | 'fast';

export const SPEED_PRESETS: Record<SpeedPreset, SpeedSettings> = {
  normal: { paceMinMs: 1500, paceMaxMs: 3000, dailyRequestBudget: 15_000 },
  // Fast is the defaults, so a fresh install and a reset both land on it.
  fast: {
    paceMinMs: DEFAULT_SETTINGS.paceMinMs,
    paceMaxMs: DEFAULT_SETTINGS.paceMaxMs,
    dailyRequestBudget: DEFAULT_SETTINGS.dailyRequestBudget,
  },
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
