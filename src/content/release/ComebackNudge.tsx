import { Notice } from '../../ui';

export interface ComebackNudgeProps {
  picks: number;
  onOpen: () => void;
  onDismiss: () => void;
}

/** The collapsed sidebar's invitation back, once this release's picks are worth a look. */
export function ComebackNudge({ picks, onOpen, onDismiss }: ComebackNudgeProps) {
  return (
    <div className="dh-sidebar__nudge">
      <Notice
        tone="info"
        title={`${picks} strong picks for this release.`}
        actions={[
          { label: 'Open', onClick: onOpen, primary: true },
          { label: 'Not now', onClick: onDismiss },
        ]}
      >
        Have a look?
      </Notice>
    </div>
  );
}
