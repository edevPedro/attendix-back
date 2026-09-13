import { adminToken, tokensMatch } from './admin.guard';

describe('admin tokens', () => {
  it('creates a stable hmac token', () => {
    const a = adminToken('admin', 'secret');
    const b = adminToken('admin', 'secret');
    expect(a).toBe(b);
    expect(tokensMatch(a, b)).toBe(true);
  });

  it('rejects mismatched tokens', () => {
    expect(tokensMatch(adminToken('admin', 'a'), adminToken('admin', 'b'))).toBe(false);
  });
});
