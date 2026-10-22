import { SettingRow } from './SettingRow';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** One plain sentence under the label. */
  description?: string;
}

/** An on/off switch with its label. A native checkbox underneath, so it's keyboard and form ready. */
export function Toggle({ label, checked, onChange, description }: ToggleProps) {
  return (
    <SettingRow label={label} description={description}>
      {({ id, describedBy }) => (
        <input
          id={id}
          className="dh-toggle__input"
          type="checkbox"
          role="switch"
          checked={checked}
          aria-checked={checked}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
        />
      )}
    </SettingRow>
  );
}
