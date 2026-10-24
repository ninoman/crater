// Service worker entry. Owns the database, the scan queue and all Bandcamp requests.
// Listeners must be registered synchronously at top level so Chrome can wake the worker for them.

import { db } from '../db';
import { listenForMessages } from '../shared/messages';
import { opfsSnapshot } from './backupHandlers';
import { recoverInterruptedImport } from './importRecovery';
import { listenForNotificationClicks } from './follows/notify';
import { keepAliveWhile } from './keepAlive';
import { chromeImportStateStore } from './importState';
import { ensureMaintenanceAlarm, MAINTENANCE_ALARM, runMaintenance } from './maintenance';
import { onSynced, startSync } from './meSync';
import { refreshCrateMates } from './recommend';
import { handlers } from './router';
import {
  ensureScannerAlarm,
  kickScanner,
  queueFollowReleases,
  SCANNER_ALARM,
  seedFromSync,
} from './scanner';
import { chromeScannerStore } from './scanner/state';

listenForMessages(handlers);
// A sync may bring new follows, whose releases are then read (decisions §22).
onSynced(async (result) => {
  await seedFromSync(result);
  await queueFollowReleases();
});
listenForNotificationClicks();
chrome.permissions.onAdded.addListener(listenForNotificationClicks);

// Opening may run a schema upgrade that takes minutes on a big database. Every other use of `db`
// waits for this same open.
keepAliveWhile(db.open()).catch((error: unknown) =>
  console.error('dighead: the database failed to open', error),
);

chrome.runtime.onStartup.addListener(() => {
  void startSync('incremental');
});

// An update may change how crate mates are scored, so don't wait for the next sync to see it.
chrome.runtime.onInstalled.addListener(() => {
  refreshCrateMates();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCANNER_ALARM) kickScanner();
  if (alarm.name === MAINTENANCE_ALARM) {
    runMaintenance().catch((error: unknown) => console.error('dighead: maintenance failed', error));
  }
});

// An import cut short by a killed worker is put right first. Until it is, the import flag it left
// behind keeps the scanner and every sync still.
void recoverInterruptedImport(db, chromeImportStateStore, opfsSnapshot, async () => {
  await chromeScannerStore.save({ importing: false });
})
  .catch((error: unknown) => console.error('dighead: import recovery failed', error))
  .finally(kickScanner);

// Every wake-up, including the one after the worker was killed, picks the queue back up.
void ensureScannerAlarm();
void ensureMaintenanceAlarm();
