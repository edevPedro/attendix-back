import { extractText, extractType, unwrapMessage, isHistoryUpsert, waMessageId } from './message-extract';

describe('message-extract', () => {
  it('reads legacy conversation and extended text', () => {
    expect(extractText({ conversation: 'oi' })).toBe('oi');
    expect(extractText({ extendedTextMessage: { text: 'olá' } })).toBe('olá');
  });

  it('reads image caption and type', () => {
    const msg = { imageMessage: { caption: 'foto', mimetype: 'image/jpeg' } };
    expect(extractText(msg)).toBe('foto');
    expect(extractType(msg)).toBe('image');
  });

  it('detects audio', () => {
    expect(extractType({ audioMessage: { ptt: true } })).toBe('audio');
  });

  it('unwraps ephemeral', () => {
    const inner = unwrapMessage({ ephemeralMessage: { message: { conversation: 'x' } } });
    expect(inner?.conversation).toBe('x');
  });

  it('ignores history upserts', () => {
    expect(isHistoryUpsert('append')).toBe(true);
    expect(isHistoryUpsert('notify')).toBe(false);
  });

  it('builds wa message id', () => {
    expect(waMessageId({ remoteJid: 'a', id: '1', participant: 'p' })).toBe('a_p_1');
  });
});
