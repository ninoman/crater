export interface SearchFieldProps {
  /** Names the field for screen readers. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A one-line filter box. Escape clears it (native to type=search). */
export function SearchField({ label, value, onChange, placeholder }: SearchFieldProps) {
  return (
    <input
      type="search"
      className="dh-search"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
