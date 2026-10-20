import { useId } from 'react';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
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
  error,
  min,
  max,
  step = 1,
}: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="dh-field">
      <label className="dh-field__label" htmlFor={id}>
        {label}
      </label>
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
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value === '' ? NaN : Number(event.target.value))}
      />
      {error && (
        <span id={errorId} className="dh-field__error">
          {error}
        </span>
      )}
    </div>
  );
}
