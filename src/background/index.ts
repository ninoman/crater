// Service worker entry. Owns the database, the scan queue and all Bandcamp requests.
// Listeners must be registered synchronously at top level so Chrome can wake the worker for them.

import { listenForMessages } from '../shared/messages';
import { ensureMaintenanceAlarm, MAINTENANCE_ALARM, runMaintenance } from './maintenance';
import { startSync } from './meSync';
import { refreshTwins } from './recommend';
import { handlers } from './router';
import { ensureScannerAlarm, kickScanner, SCANNER_ALARM } from './scanner';

listenForMessages(handlers);

chrome.runtime.onStartup.addListener(() => {
  void startSync('incremental');
});

// An update may change how twins are scored, so don't wait for the next sync to see it.
chrome.runtime.onInstalled.addListener(() => {
  refreshTwins();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCANNER_ALARM) kickScanner();
  if (alarm.name === MAINTENANCE_ALARM) {
    runMaintenance().catch((error: unknown) => console.error('dighead: maintenance failed', error));
  }
});

// Every wake-up, including the one after the worker was killed, picks the queue back up.
void ensureScannerAlarm();
void ensureMaintenanceAlarm();
kickScanner();
