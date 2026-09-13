import { isCaptureEnabled, resolveFanoutJids, inboundPrefix } from './capture.policy';

describe('capture.policy', () => {
  it('starts with zero captures', () => {
    expect(isCaptureEnabled(new Set(), '5511@s.whatsapp.net')).toBe(false);
    expect(isCaptureEnabled([], '5511@s.whatsapp.net')).toBe(false);
  });

  it('allows only enabled jids', () => {
    const set = new Set(['5511@s.whatsapp.net']);
    expect(isCaptureEnabled(set, '5511@s.whatsapp.net')).toBe(true);
    expect(isCaptureEnabled(set, '5512@s.whatsapp.net')).toBe(false);
  });

  it('resolves fan-out members of a discord channel', () => {
    const jids = resolveFanoutJids('c1', [
      { discordChannelId: 'c1', jid: 'a', enabled: true },
      { discordChannelId: 'c1', jid: 'b', enabled: true },
      { discordChannelId: 'c2', jid: 'c', enabled: true },
      { discordChannelId: 'c1', jid: 'd', enabled: false },
    ]);
    expect(jids).toEqual(['a', 'b']);
  });

  it('prefixes inbound only when several jids share a channel', () => {
    expect(inboundPrefix(1, 'Ana')).toBe('');
    expect(inboundPrefix(2, 'Ana')).toBe('**Ana**\n');
  });
});
