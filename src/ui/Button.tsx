import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Square button for a single icon or glyph. Needs an aria-label. */
  icon?: boolean;
}

export function Button({
  variant = 'secondary',
  icon = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('dh-button', `dh-button--${variant}`, icon && 'dh-button--icon', className)}
      {...rest}
    />
  );
}
