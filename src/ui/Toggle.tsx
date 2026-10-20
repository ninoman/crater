import { useId } from 'react';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off switch with its label. A native checkbox underneath, so it's keyboard and form ready. */
export function Toggle({ label, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="dh-toggle">
      <input
        id={id}
        className="dh-toggle__input"
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="dh-toggle__label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
