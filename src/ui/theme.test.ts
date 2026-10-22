import { describe, expect, it } from 'vitest';
import { contrast, mix } from './color';
import { themeVariables } from './theme';

const dark = { background: '#000000', text: '#ffffff', secondaryText: '#888888', link: '#8cb8de' };

describe('mix', () => {
  it('blends two colours', () => {
    expect(mix('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(mix('#ffffff', '#000000', 0)).toBe('#000000');
    expect(mix('#ffffff', '#000000', 0.5)).toBe('#808080');
  });
});

describe('contrast', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrast('#8cb8de', '#8cb8de')).toBe(1);
  });
});

describe('themeVariables', () => {
  it('takes the page colours and shades borders and hovers from text into background', () => {
    const theme = themeVariables(dark);
    expect(theme).toMatchObject({
      '--dh-color-bg': '#000000',
      '--dh-color-text': '#ffffff',
      '--dh-color-muted': '#888888',
      '--dh-color-accent': '#8cb8de',
      '--dh-color-border': '#262626',
      '--dh-color-bg-hover': '#141414',
      '--dh-color-on-accent': '#000000',
    });
  });

  it('puts white text on a dark accent', () => {
    const light = {
      background: '#ffffff',
      text: '#333333',
      secondaryText: '#777777',
      link: '#0e5a9c',
    };
    expect(themeVariables(light)?.['--dh-color-on-accent']).toBe('#ffffff');
  });

  it('falls back when secondary text or links are too faint to read', () => {
    const theme = themeVariables({ ...dark, secondaryText: '#222222', link: '#111111' });
    expect(theme?.['--dh-color-muted']).toBe(mix('#ffffff', '#000000', 0.7));
    expect(theme?.['--dh-color-accent']).toBe('#ffffff');
  });

  it('gives no theme when the text itself is unreadable', () => {
    expect(themeVariables({ ...dark, text: '#333333' })).toBeNull();
  });
});
