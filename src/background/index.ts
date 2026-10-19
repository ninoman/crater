// Service worker entry. Owns the database, the scan queue and all Bandcamp requests.
// Listeners must be registered synchronously at top level so Chrome can wake the worker for them.

import { listenForMessages } from '../shared/messages';
import { startSync } from './meSync';
import { handlers } from './router';

listenForMessages(handlers);

chrome.runtime.onStartup.addListener(() => {
  void startSync('incremental');
});
