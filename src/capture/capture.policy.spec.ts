import { isCaptureEnabled, resolveFanoutJids, inboundPrefix, routedChannelId } from './capture.policy';

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

  it('prefers list channel over 1:1 when routing inbound', () => {
    expect(
      routedChannelId({
        jid: 'a',
        enabled: true,
        discordChannelId: 'dm',
        listChannelId: 'list',
      }),
    ).toBe('list');
  });

  it('resolves fan-out from the list channel first', () => {
    const bindings = [
      { discordChannelId: 'c1', listChannelId: 'list', jid: 'a', enabled: true },
      { discordChannelId: 'c1', listChannelId: 'list', jid: 'b', enabled: true },
      { discordChannelId: 'c2', listChannelId: null, jid: 'c', enabled: true },
      { discordChannelId: 'c1', listChannelId: null, jid: 'd', enabled: false },
    ];
    expect(resolveFanoutJids('list', bindings)).toEqual(['a', 'b']);
    expect(resolveFanoutJids('c2', bindings)).toEqual(['c']);
    expect(resolveFanoutJids('c1', bindings)).toEqual([]);
  });

  it('prefixes inbound only when several jids share a channel', () => {
    expect(inboundPrefix(1, 'Ana')).toBe('');
    expect(inboundPrefix(2, 'Ana')).toBe('**Ana**\n');
  });
});
