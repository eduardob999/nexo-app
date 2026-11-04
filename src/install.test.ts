import { describe, expect, it } from 'vitest';
import { installState } from './install';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/130';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604';

describe('installState', () => {
  it('offers nothing once installed', () => {
    expect(installState(ANDROID, true, true)).toBe('installed');
  });
  it('offers the browser prompt when it is available', () => {
    expect(installState(ANDROID, false, true)).toBe('ready');
  });
  it('gives iPhone instructions, since it has no prompt', () => {
    expect(installState(IPHONE, false, false)).toBe('ios');
  });
  it('points to the browser menu otherwise', () => {
    expect(installState(ANDROID, false, false)).toBe('manual');
  });
});
