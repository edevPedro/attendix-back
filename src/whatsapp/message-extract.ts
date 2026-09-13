export type ExtractedType = 'text' | 'image' | 'audio' | 'file' | 'unknown';

export function unwrapMessage(message: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!message) {
    return null;
  }
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.viewOnceMessageV2Extension?.message ||
    message.documentWithCaptionMessage?.message ||
    message.editedMessage?.message ||
    message
  );
}

export function extractText(message: Record<string, any> | null | undefined): string | undefined {
  const m = unwrapMessage(message);
  if (!m) {
    return undefined;
  }
  const text =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText;
  return typeof text === 'string' && text.length ? text : undefined;
}

export function extractType(message: Record<string, any> | null | undefined): ExtractedType {
  const m = unwrapMessage(message);
  if (!m) {
    return 'unknown';
  }
  if (m.imageMessage || m.stickerMessage) {
    return 'image';
  }
  if (m.audioMessage) {
    return 'audio';
  }
  if (m.videoMessage || m.documentMessage) {
    return 'file';
  }
  if (m.conversation || m.extendedTextMessage) {
    return 'text';
  }
  return extractText(m) ? 'text' : 'unknown';
}

export function isHistoryUpsert(type?: string): boolean {
  return type === 'append' || type === 'prepend';
}

export function waMessageId(key: { remoteJid?: string | null; id?: string | null; participant?: string | null }): string {
  return [key.remoteJid || '', key.participant || '', key.id || ''].join('_');
}
