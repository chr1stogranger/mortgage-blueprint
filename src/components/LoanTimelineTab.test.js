import { describe, it, expect } from 'vitest';
import { readLiveLoan, daysUntil } from './LoanTimelineTab.jsx';

const snap = { v: 1, stage: 'CLEAR_TO_CLOSE', stage_label: 'Clear to close', phases: [{ id: 'ctc', label: 'Clear to close', state: 'now', date: '' }], steps: [], key_dates: {} };

describe('readLiveLoan', () => {
  it('returns the snapshot Ops saved on the client', () => {
    expect(readLiveLoan({ live_loan: snap })).toBe(snap);
  });
  it('is null for a lead, a local scenario, or a snapshot this build cannot read', () => {
    expect(readLiveLoan(null)).toBeNull();
    expect(readLiveLoan({})).toBeNull();
    expect(readLiveLoan({ live_loan: null })).toBeNull();
    expect(readLiveLoan({ live_loan: { ...snap, v: 2 } })).toBeNull();
    expect(readLiveLoan({ live_loan: { ...snap, phases: [] } })).toBeNull();
    expect(readLiveLoan({ live_loan: { v: 1, phases: snap.phases } })).toBeNull();
  });
});

describe('daysUntil', () => {
  const now = new Date(2026, 10, 25, 23, 30); // late evening, Nov 25
  it('counts calendar days in local time', () => {
    expect(daysUntil('2026-12-11', now)).toBe(16);
    expect(daysUntil('2026-11-26', now)).toBe(1);
    expect(daysUntil('2026-11-25', now)).toBe(0);
    expect(daysUntil('2026-11-20', now)).toBe(-5);
  });
  it('is null without a usable date', () => {
    expect(daysUntil('', now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('soon', now)).toBeNull();
  });
});
