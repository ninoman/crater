import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

interface ButtonLook {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Square button for a single icon or glyph. Needs an aria-label. */
  icon?: boolean;
}

export type ButtonProps = ButtonLook & ButtonHTMLAttributes<HTMLButtonElement>;
export type LinkButtonProps = ButtonLook & AnchorHTMLAttributes<HTMLAnchorElement>;

function buttonClass({ variant = 'secondary', icon = false }: ButtonLook, className?: string) {
  return cx('dh-button', `dh-button--${variant}`, icon && 'dh-button--icon', className);
}

export function Button({ variant, icon, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, icon }, className)} {...rest} />;
}

/** A link that looks like a Button, for actions that navigate. */
export function LinkButton({ variant, icon, className, ...rest }: LinkButtonProps) {
  return <a className={buttonClass({ variant, icon }, className)} {...rest} />;
}
