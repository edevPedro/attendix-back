import { loginAllowed, loginFailed, loginSucceeded, resetLoginThrottle } from './login-throttle';

describe('login throttle', () => {
  beforeEach(() => resetLoginThrottle());

  it('blocks after repeated failures', () => {
    const ip = '10.0.0.9';
    for (let i = 0; i < 8; i++) {
      expect(loginAllowed(ip)).toBe(true);
      loginFailed(ip);
    }
    expect(loginAllowed(ip)).toBe(false);
    loginSucceeded(ip);
    expect(loginAllowed(ip)).toBe(true);
  });
});
