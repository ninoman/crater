// Import first: gives the eval an IndexedDB, and the `self` dexie-export-import reads on load.
import 'fake-indexeddb/auto';

Object.assign(globalThis, { self: globalThis });
