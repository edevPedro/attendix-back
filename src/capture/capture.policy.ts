export function isCaptureEnabled(enabledJids: Iterable<string>, jid: string): boolean {
  const set = enabledJids instanceof Set ? enabledJids : new Set(enabledJids);
  return set.has(jid);
}

export function resolveFanoutJids(
  channelId: string,
  bindings: Array<{ discordChannelId: string | null; jid: string; enabled: boolean }>,
): string[] {
  return bindings
    .filter((row) => row.enabled && row.discordChannelId === channelId)
    .map((row) => row.jid);
}

export function inboundPrefix(jidCount: number, displayName: string): string {
  if (jidCount <= 1) {
    return '';
  }
  return `**${displayName}**\n`;
}
