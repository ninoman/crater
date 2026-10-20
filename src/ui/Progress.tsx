export interface ProgressProps {
  value: number;
  max: number;
  /** What is progressing, for screen readers. */
  label: string;
}

/** A thin determinate progress bar. */
export function Progress({ value, max, label }: ProgressProps) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="dh-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="dh-progress__bar" style={{ width: `${percent}%` }} />
    </div>
  );
}
