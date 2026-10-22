import { useId } from 'react';

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedProps<Value extends string> {
  /** Names the group for screen readers. */
  label: string;
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** Id of text that explains the choice, e.g. a setting's description. */
  describedBy?: string;
}

/** A small either/or switch, e.g. all / any. Native radios underneath, so arrow keys work. */
export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
  describedBy,
}: SegmentedProps<Value>) {
  const name = useId();
  return (
    <div
      className="dh-segmented"
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
    >
      {options.map((option) => (
        <label key={option.value} className="dh-segmented__option">
          <input
            className="dh-segmented__input"
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span className="dh-segmented__label">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
