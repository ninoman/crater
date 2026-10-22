import { SettingRow } from './SettingRow';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** One plain sentence under the label. */
  description?: string;
  /** Shown under the input, and marks it invalid. */
  error?: string;
  min?: number;
  max?: number;
  step?: number;
}

/** A labelled whole-number input. An empty input reports NaN, so validation can catch it. */
export function NumberField({
  label,
  value,
  onChange,
  description,
  error,
  min,
  max,
  step = 1,
}: NumberFieldProps) {
  return (
    <SettingRow label={label} description={description} error={error}>
      {({ id, describedBy }) => (
        <input
          id={id}
          className="dh-field__input"
          type="number"
          inputMode="numeric"
          value={Number.isNaN(value) ? '' : value}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) =>
            onChange(event.target.value === '' ? NaN : Number(event.target.value))
          }
        />
      )}
    </SettingRow>
  );
}
