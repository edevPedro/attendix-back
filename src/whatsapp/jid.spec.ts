import { chatKind, normalizeJid, shouldIgnoreJid, sanitizeChannelName } from './jid';

describe('jid helpers', () => {
  it('strips device suffix on user jids', () => {
    expect(normalizeJid('5511999:12@s.whatsapp.net')).toBe('5511999@s.whatsapp.net');
  });

  it('keeps group jids', () => {
    expect(normalizeJid('120@g.us')).toBe('120@g.us');
    expect(chatKind('120@g.us')).toBe('group');
  });

  it('ignores status and newsletters', () => {
    expect(shouldIgnoreJid('status@broadcast')).toBe(true);
    expect(shouldIgnoreJid('x@newsletter')).toBe(true);
    expect(shouldIgnoreJid('5511@s.whatsapp.net')).toBe(false);
  });

  it('sanitizes discord channel names', () => {
    expect(sanitizeChannelName('João Silva!', 'jid')).toMatch(/joao-silva/);
  });
});
