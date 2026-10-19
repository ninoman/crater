// Service worker entry. Owns the database, the scan queue and all Bandcamp requests.

import { listenForMessages } from '../shared/messages';
import { handlers } from './router';

listenForMessages(handlers);
