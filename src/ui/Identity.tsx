import type { ReactNode } from 'react';

export interface IdentityProps {
  avatarUrl: string | null;
  name: string;
  /** Their Bandcamp page. Opens in a new tab. */
  href: string;
  /** Small tags after the name. */
  badges?: ReactNode;
}

/** A fan (or artist, or label) as avatar and linked name. */
export function Identity({ avatarUrl, name, href, badges }: IdentityProps) {
  return (
    <span className="dh-identity">
      {avatarUrl ? (
        <img className="dh-identity__avatar" src={avatarUrl} alt="" loading="lazy" />
      ) : (
        <span className="dh-identity__avatar dh-identity__avatar--empty" aria-hidden="true" />
      )}
      <a className="dh-identity__name" href={href} target="_blank" rel="noreferrer">
        {name}
      </a>
      {badges}
    </span>
  );
}
