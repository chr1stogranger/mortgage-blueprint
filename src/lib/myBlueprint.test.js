import { describe, it, expect } from 'vitest';
import { isToken, pickShared, wantsOpen, canOpenMine } from './myBlueprint.js';

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
