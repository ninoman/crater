import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from './settings';
import {
  applySpeedPreset,
  SPEED_PRESETS,
  type SpeedPreset,
  speedPresetOf,
} from './settingsPresets';

const PRESETS = Object.keys(SPEED_PRESETS) as SpeedPreset[];

describe('speed presets', () => {
  it('reads the defaults as fast', () => {
    expect(speedPresetOf(DEFAULT_SETTINGS)).toBe('fast');
  });

  it.each(PRESETS)('applies and recognises %s, within the allowed limits', (preset) => {
    const settings = applySpeedPreset(DEFAULT_SETTINGS, preset);
    expect(speedPresetOf(settings)).toBe(preset);
    expect(validateSettings(settings)).toEqual({});
  });

  it('leaves the other settings alone', () => {
    const settings = applySpeedPreset({ ...DEFAULT_SETTINGS, topCrateMatesK: 50 }, 'normal');
    expect(settings.topCrateMatesK).toBe(50);
  });

  it('reads hand-edited values as custom', () => {
    expect(speedPresetOf({ ...DEFAULT_SETTINGS, paceMaxMs: 3500 })).toBe('custom');
  });
});
