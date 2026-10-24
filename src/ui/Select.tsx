import { useId } from 'react';

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SelectProps<Value extends string> {
  /** Shown before the menu, and names it for screen readers. */
  label: string;
  options: readonly SelectOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/** A labelled menu of a few choices, e.g. what to sort by. A native select, so it just works. */
export function Select<Value extends string>({
  label,
  options,
  value,
  onChange,
}: SelectProps<Value>) {
  const id = useId();
  return (
    <span className="dh-select">
      <label className="dh-select__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="dh-select__control"
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}
