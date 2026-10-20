import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { useId } from 'react';
import { CheckIcon } from './icons';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Keeps the label for screen readers only, e.g. a row's select box. */
  hideLabel?: boolean;
}

/** A labelled checkbox (Radix), styled with our tokens. */
export function Checkbox({ label, checked, onChange, hideLabel = false }: CheckboxProps) {
  const id = useId();
  return (
    <div className="dh-checkbox">
      <RadixCheckbox.Root
        id={id}
        className="dh-checkbox__box"
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
        aria-label={hideLabel ? label : undefined}
      >
        <RadixCheckbox.Indicator className="dh-checkbox__indicator">
          <CheckIcon />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {!hideLabel && (
        <label className="dh-checkbox__label" htmlFor={id}>
          {label}
        </label>
      )}
    </div>
  );
}
