import { describe, it, expect } from 'vitest';
import { stateSig, changedKeys, resolveRemote } from './useBlueprintSync';

describe('stateSig', () => {
  it('ignores key order and per-device theme keys', () => {
    const a = { salesPrice: 800000, rate: 6.5, darkMode: true, themeMode: 'dark' };
    const b = { themeMode: 'light', rate: 6.5, darkMode: false, salesPrice: 800000 };
    expect(stateSig(a)).toBe(stateSig(b));
  });
  it('sees nested changes', () => {
    expect(stateSig({ debts: [{ bal: 1 }] })).not.toBe(stateSig({ debts: [{ bal: 2 }] }));
  });
});

describe('changedKeys', () => {
  it('lists only keys whose value moved', () => {
    expect(changedKeys({ a: 1, b: [1], c: 3 }, { a: 1, b: [2], d: 4 }).sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('resolveRemote', () => {
  const base = { salesPrice: 800000, rate: 6.5, downPct: 20, darkMode: true };

  it('ignores our own write echoing back', () => {
    const mine = { ...base, salesPrice: 850000 };
    expect(resolveRemote({ base, local: mine, remote: mine, sentSigs: [stateSig(mine)] })).toBeNull();
  });

  it('ignores a row identical to what is on screen (theme differences aside)', () => {
    const remote = { ...base, darkMode: false };
    expect(resolveRemote({ base, local: base, remote })).toBeNull();
  });

  it('applies the other side’s change', () => {
    const remote = { ...base, rate: 6.25, darkMode: false };
    const next = resolveRemote({ base, local: base, remote });
    expect(next.rate).toBe(6.25);
    expect(next.darkMode).toBe(true); // keeps this device's theme
  });

  it('keeps a field the local user is mid-edit on (no clobber)', () => {
    // LO changed rate; borrower meanwhile typed a new price that isn't saved yet.
    const remote = { ...base, rate: 6.25 };
    const local = { ...base, salesPrice: 910000 };
    const next = resolveRemote({ base, local, remote });
    expect(next.rate).toBe(6.25);
    expect(next.salesPrice).toBe(910000);
  });

  it('after applying, the screen state equals the DB → the autosave is an echo', () => {
    const remote = { ...base, rate: 6.25 };
    const next = resolveRemote({ base, local: base, remote });
    // The hook sets baseRef = remote; isEcho compares the next getState() to it.
    expect(stateSig(next)).toBe(stateSig(remote));
  });

  it('a catch-up re-read of an unchanged row leaves local edits alone', () => {
    const local = { ...base, salesPrice: 910000 };
    expect(resolveRemote({ base, local, remote: { ...base } })).toBeNull();
  });

  it('with no baseline, takes the remote state whole', () => {
    const remote = { ...base, rate: 7 };
    expect(resolveRemote({ base: null, local: base, remote })).toBe(remote);
  });
});
