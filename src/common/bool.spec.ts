import { asBool } from './bool';

describe('asBool', () => {
  it('coerces json and form values', () => {
    expect(asBool(true)).toBe(true);
    expect(asBool('false', true)).toBe(false);
    expect(asBool('true')).toBe(true);
    expect(asBool(undefined, false)).toBe(false);
    expect(asBool(null, true)).toBe(true);
  });
});
