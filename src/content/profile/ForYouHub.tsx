import { Tabs } from '../../ui';
import { FollowsTab } from './follows/FollowsTab';
import { ForYouTab } from './forYou/ForYouTab';
import { LatestTab } from './latest/LatestTab';

/** For you's sub-tabs. Each is a route of its own, so links and the follows notification land on it. */
export type ForYouRoute = 'for-you' | 'latest' | 'follows';

const SUB_TABS: readonly { value: ForYouRoute; label: string }[] = [
  { value: 'for-you', label: 'Picks' },
  { value: 'latest', label: "Crate mates' latest" },
  { value: 'follows', label: 'New from follows' },
];

export interface ForYouHubProps {
  route: ForYouRoute;
  openRoute: (route: ForYouRoute) => void;
}

/**
 * The For you tab: picks, crate mates' latest and new from follows as sub-tabs. Our own small
 * tabs, so they don't read as more of Bandcamp's tab bar. Only the open one is mounted, so each
 * loads fresh data when opened.
 */
export function ForYouHub({ route, openRoute }: ForYouHubProps) {
  return (
    <Tabs
      label="For you"
      value={route}
      onValueChange={(value) => {
        const next = SUB_TABS.find((tab) => tab.value === value);
        if (next) openRoute(next.value);
      }}
      items={SUB_TABS.map(({ value, label }) => ({
        value,
        label,
        content: <SubTab route={value} />,
      }))}
    />
  );
}

function SubTab({ route }: { route: ForYouRoute }) {
  switch (route) {
    case 'for-you':
      return <ForYouTab />;
    case 'latest':
      return <LatestTab />;
    case 'follows':
      return <FollowsTab />;
  }
}
