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

export const HideIcon = () => (
  <Icon>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

export const QueueIcon = () => (
  <Icon>
    <path d="M2.5 4.5h7M2.5 8h7M2.5 11.5h4M12 8.5v5M9.5 11h5" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);
