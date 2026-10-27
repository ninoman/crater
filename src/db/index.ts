import { CraterDb } from './schema';

export * from './backup';
export * from './gzip';
export * from './mappers';
export * from './matchIndex';
export * from './repo';
export * from './storage';
export * from './tagBackup';
export * from './tagFilter';
export type * from './schema';
export { CraterDb };

/** The extension's database. Only the service worker should import this. */
export const db = new CraterDb();
