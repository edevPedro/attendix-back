import { hashesMatch } from './auth.service';

describe('auth hashes', () => {
  it('compares passwords of different lengths safely', () => {
    expect(hashesMatch('pw', 'pw')).toBe(true);
    expect(hashesMatch('admin', 'admi')).toBe(false);
  });
});
