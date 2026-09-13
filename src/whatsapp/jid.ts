export function normalizeJid(jid?: string | null): string {
  if (!jid) {
    return '';
  }
  if (
    jid.endsWith('@g.us') ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@lid')
  ) {
    const [user, server] = jid.split('@');
    if (!server) {
      return jid;
    }
    if (jid.endsWith('@lid')) {
      return `${user.split(':')[0]}@${server}`;
    }
    return jid;
  }
  const [user, server] = jid.split('@');
  if (!server) {
    return jid;
  }
  return `${user.split(':')[0]}@${server}`;
}

export function chatKind(jid: string): 'dm' | 'group' | 'other' {
  if (jid.endsWith('@g.us')) {
    return 'group';
  }
  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')) {
    return 'dm';
  }
  return 'other';
}

export function shouldIgnoreJid(jid: string): boolean {
  return (
    !jid ||
    jid === 'status@broadcast' ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@newsletter')
  );
}

export function sanitizeChannelName(name: string, jid: string): string {
  const base = (name || jid)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `chat-${jid.replace(/[^a-z0-9]/gi, '').slice(0, 20)}`;
}
