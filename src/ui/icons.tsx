// Small stroke icons, sized by the button text and coloured by currentColor.

import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="dh-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Icon>
    <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
  </Icon>
);

export const StopIcon = () => (
  <Icon>
    <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
  </Icon>
);

export const PauseIcon = () => (
  <Icon>
    <rect x="4" y="3.5" width="2.5" height="9" rx="0.5" fill="currentColor" />
    <rect x="9.5" y="3.5" width="2.5" height="9" rx="0.5" fill="currentColor" />
  </Icon>
);

export const ExternalIcon = () => (
  <Icon>
    <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
  </Icon>
);

/** An ×: closes a panel, or hides a row. */
export const CloseIcon = () => (
  <Icon>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

/** A cart; a tick inside once the release is in it. */
export const CartIcon = ({ filled = false }: { filled?: boolean }) => (
  <Icon>
    <path d="M1.5 2.5h2l1.6 7.5h7.4l1.5-5.5H4.3" />
    <circle cx="6" cy="13" r="1" fill="currentColor" />
    <circle cx="11.5" cy="13" r="1" fill="currentColor" />
    {filled && <path d="M6.8 6.8l1.4 1.4 2.6-2.6" />}
  </Icon>
);

export const InfoIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.5v3.5" />
    <circle cx="8" cy="5" r="0.5" fill="currentColor" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);

export const HeardIcon = () => (
  <Icon>
    <path d="M3 10V8a5 5 0 0 1 10 0v2" />
    <rect x="2.5" y="9.5" width="3" height="4" rx="1" />
    <rect x="10.5" y="9.5" width="3" height="4" rx="1" />
  </Icon>
);

export const NextIcon = () => (
  <Icon>
    <path d="M4 3.5v9l6-4.5z" fill="currentColor" />
    <path d="M12 3.5v9" />
  </Icon>
);

export const PreviousIcon = () => (
  <Icon>
    <path d="M12 3.5v9l-6-4.5z" fill="currentColor" />
    <path d="M4 3.5v9" />
  </Icon>
);

export const ReorderIcon = () => (
  <Icon>
    <path d="M5 13V3M2.5 5.5 5 3l2.5 2.5M11 3v10M8.5 10.5 11 13l2.5-2.5" />
  </Icon>
);

/** Bandcamp's wishlist heart; filled once the release is in your wishlist. */
export const HeartIcon = ({ filled = false }: { filled?: boolean }) => (
  <Icon>
    <path
      d="M8 13.5S2.5 10.2 2.5 6.2A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.2c0 4-5.5 7.3-5.5 7.3z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);
