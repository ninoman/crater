// Message handlers for New from your follows (decisions §22).

import { db, getMe, setFollowMute, type DigheadDb } from '../../db';
import type { MessageHandlers } from '../../shared/messages';
import { loadSettings } from '../../shared/settings';
import { openFollowsDigest } from '../scanner';
import { computeFollowsDigest } from './digest';
import { chromeFollowsStore } from './state';

type FollowsHandlers = Pick<
  MessageHandlers,
  'getFollowsDigest' | 'followsDigestOpened' | 'setFollowMute'
>;

export function followsHandlers(database: DigheadDb = db): FollowsHandlers {
  return {
    getFollowsDigest: async ({ previousVisitAt }) => {
      const [me, settings] = await Promise.all([getMe(database), loadSettings()]);
      return computeFollowsDigest(
        database,
        me,
        settings.topCrateMatesK,
        previousVisitAt,
        Date.now(),
      );
    },
    followsDigestOpened: async () => {
      const now = Date.now();
      const { lastVisitAt } = await chromeFollowsStore.load();
      await chromeFollowsStore.save({ lastVisitAt: now });
      await openFollowsDigest(now);
      return { previousVisitAt: lastVisitAt };
    },
    setFollowMute: async ({ bandId, muted }) => {
      await setFollowMute(database, bandId, muted, Date.now());
      return null;
    },
  };
}
