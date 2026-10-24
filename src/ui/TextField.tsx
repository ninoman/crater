import { SettingRow } from './SettingRow';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** One plain sentence under the label. */
  description?: string;
  /** Shown under the input, and marks it invalid. */
  error?: string;
  placeholder?: string;
}

/** A labelled one-line text input. */
export function TextField({
  label,
  value,
  onChange,
  description,
  error,
  placeholder,
}: TextFieldProps) {
  return (
    <SettingRow label={label} description={description} error={error}>
      {({ id, describedBy }) => (
        <input
          id={id}
          className="dh-field__input dh-field__input--text"
          type="text"
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </SettingRow>
  );
}
