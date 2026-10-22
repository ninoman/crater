import { type ReactNode, useId } from 'react';

export interface SettingRowIds {
  /** Goes on the control, so the label points at it. */
  id: string;
  labelId: string;
  /** The description and error, for aria-describedby. */
  describedBy: string | undefined;
}

export interface SettingRowProps {
  label: string;
  /** One plain sentence on what the setting does. */
  description?: string;
  /** Shown under the description. */
  error?: string;
  /** The control is a group (e.g. radios), which a <label> can't point at. */
  group?: boolean;
  children: (ids: SettingRowIds) => ReactNode;
}

/** One setting: label and control on a line, with the description and any error under them. */
export function SettingRow({ label, description, error, group, children }: SettingRowProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy =
    [description && descriptionId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="dh-setting">
      {group ? (
        <span id={labelId} className="dh-setting__label">
          {label}
        </span>
      ) : (
        <label id={labelId} className="dh-setting__label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="dh-setting__control">{children({ id, labelId, describedBy })}</div>
      {description && (
        <p id={descriptionId} className="dh-setting__description">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="dh-setting__error">
          {error}
        </p>
      )}
    </div>
  );
}
