import { describe, it, expect, vi, afterEach } from 'vitest';
import { isToken, recallMine, rememberIfMine, pickShared, needsChoice, sharedChoices, wantsOpen, canOpenMine } from './myBlueprint.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('pickShared', () => {
  it('opens the one they had open last while it is still shared with them', () => {
    expect(pickShared([{ share_token: A }, { share_token: B }], B)).toBe(B);
  });
  it('else the newest (first) one', () => {
    expect(pickShared([{ share_token: A }, { share_token: B }], '33333333-3333-4333-8333-333333333333')).toBe(A);
    expect(pickShared([{ share_token: A }])).toBe(A);
  });
  it('is empty when nothing usable is shared', () => {
    expect(pickShared([])).toBe('');
    expect(pickShared(null)).toBe('');
    expect(pickShared([{ share_token: 'nope' }, {}])).toBe('');
  });
});

describe('needsChoice', () => {
  const two = [{ share_token: A }, { share_token: B }];
  it('never asks someone on one Blueprint', () => {
    expect(needsChoice([{ share_token: A }], '', true)).toBe(false);
    expect(needsChoice([], '', true)).toBe(false);
    expect(needsChoice([{ share_token: A }, { share_token: 'junk' }])).toBe(false);
  });
  it('asks on a device that has not opened one of them', () => {
    expect(needsChoice(two)).toBe(true);
    expect(needsChoice(two, 'none')).toBe(true);
  });
  it('goes back to the last one on a returning visit', () => {
    expect(needsChoice(two, B)).toBe(false);
  });
  it('always asks after an invite, which may be for a different one', () => {
    expect(needsChoice(two, B, true)).toBe(true);
  });
  it('lists only the ones that can be opened', () => {
    expect(sharedChoices([{ share_token: A }, {}, null, { share_token: 'x' }])).toEqual([{ share_token: A }]);
  });
});

describe('address checks', () => {
  it('knows a file id from junk', () => {
    expect(isToken(A)).toBe(true);
    expect(isToken('abc')).toBe(false);
    expect(isToken(null)).toBe(false);
  });
  it('reads the invite flag', () => {
    expect(wantsOpen({ search: '?open=1' })).toBe(true);
    expect(wantsOpen({ search: '?scenario=x' })).toBe(false);
  });
  it('never takes over a page that asked for something else', () => {
    expect(canOpenMine({ hostname: 'blueprint.realstack.app', pathname: '/pricepoint', search: '' })).toBe(false);
    expect(canOpenMine({ hostname: 'pricepoint.realstack.app', pathname: '/', search: '' })).toBe(false);
    expect(canOpenMine({ hostname: 'blueprint.realstack.app', pathname: '/', search: '?listing=abc' })).toBe(false);
    expect(canOpenMine({ hostname: 'blueprint.realstack.app', pathname: '/', search: '?account=1' })).toBe(false);
  });
});

describe('rememberIfMine', () => {
  const store = new Map();
  const stub = (shared) => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ shared }) }));
  };
  afterEach(() => vi.unstubAllGlobals());

  it('remembers a Blueprint that is shared with the person', async () => {
    stub([{ share_token: A }]);
    await rememberIfMine('u1', A, 'jwt');
    expect(recallMine('u1')).toBe(A);
  });
  it('does not remember a client link a loan officer opened', async () => {
    stub([]); // Ops answers the loan team with an empty list
    await rememberIfMine('u1', A, 'jwt');
    expect(recallMine('u1')).toBe('');
  });
  it('ignores what the first version remembered', () => {
    stub([]);
    store.set('bp_my_blueprint_u1', A);
    expect(recallMine('u1')).toBe('');
  });
});
