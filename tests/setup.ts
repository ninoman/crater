// dexie-export-import reads `self` when it loads, as it would in the service worker.
Object.assign(globalThis, { self: globalThis });
