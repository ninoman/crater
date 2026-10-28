import { Progress } from './Progress';

export interface InlineProgressProps {
  /** What has got how far, e.g. "Checked 582 of 599 accounts". Also the bar's label. */
  label: string;
  value: number;
  max: number;
}

/** Work still going on next to content that's already shown: a short line and a small bar. */
export function InlineProgress({ label, value, max }: InlineProgressProps) {
  return (
    <div className="dh-inline-progress">
      <span className="dh-inline-progress__label">{label}</span>
      <Progress value={value} max={max} label={label} />
    </div>
  );
}
