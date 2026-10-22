// Small sRGB helpers for deriving theme colours. Colours are `#rrggbb` strings.

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** `amount` of `a` over `b`: 1 is all `a`, 0 all `b`. */
export function mix(a: string, b: string, amount: number): string {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(
    [0, 1, 2].map((i) => (x[i] as number) * amount + (y[i] as number) * (1 - amount)) as Rgb,
  );
}

export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${toRgb(hex).join(', ')}, ${alpha})`;
}

/** WCAG relative luminance, 0 for black to 1 for white. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
