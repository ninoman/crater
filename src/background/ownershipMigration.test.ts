import { describe, expect, it } from 'vitest';
import type { CraterDb } from '../db';
import { kickOwnershipMigration, stopOwnershipMigration } from './ownershipMigration';

const db = {} as CraterDb;

/** A step that has `chunks` chunks to do, and waits for `gate` before each. */
function steps(chunks: number, gate: () => Promise<void> = async () => undefined) {
  let done = 0;
  const step = async () => {
    await gate();
    if (done === chunks) return false;
    done++;
    return true;
  };
  return { step, done: () => done };
}

describe('kickOwnershipMigration', () => {
  it('runs steps until there is nothing left', async () => {
    const work = steps(3);
    await kickOwnershipMigration(db, work.step);
    expect(work.done()).toBe(3);
  });

  it('runs once however often it is kicked', async () => {
    const work = steps(2);
    const first = kickOwnershipMigration(db, work.step);
    expect(kickOwnershipMigration(db, work.step)).toBe(first);
    await first;
    expect(work.done()).toBe(2);
  });

  it('stops after the chunk in progress, and carries on when kicked again', async () => {
    let paused = true;
    let release = () => {};
    const gate = () =>
      paused ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
    const work = steps(5, gate);
    const running = kickOwnershipMigration(db, work.step);
    const stopped = stopOwnershipMigration();
    paused = false;
    release();
    await stopped;
    await running;
    expect(work.done()).toBe(1);

    await kickOwnershipMigration(db, work.step);
    expect(work.done()).toBe(5);
  });
});
