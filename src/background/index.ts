// Service worker entry. Owns the database, the scan queue and all Bandcamp requests.
// Listeners must be registered synchronously at top level so Chrome can wake the worker for them.

import { listenForMessages } from '../shared/messages';
import { startSync } from './meSync';
import { handlers } from './router';
import { ensureScannerAlarm, kickScanner, SCANNER_ALARM } from './scanner';

listenForMessages(handlers);

chrome.runtime.onStartup.addListener(() => {
  void startSync('incremental');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCANNER_ALARM) kickScanner();
});

// Every wake-up, including the one after the worker was killed, picks the queue back up.
void ensureScannerAlarm();
kickScanner();
