export type ChannelBinding = {
  jid: string;
  enabled: boolean;
  discordChannelId: string | null;
  listChannelId: string | null;
};

export function isCaptureEnabled(enabledJids: Iterable<string>, jid: string): boolean {
  const set = enabledJids instanceof Set ? enabledJids : new Set(enabledJids);
  return set.has(jid);
}

/** List channel wins over the 1:1 Discord channel. */
export function routedChannelId(b: ChannelBinding): string | null {
  return b.listChannelId || b.discordChannelId || null;
}

export function resolveFanoutJids(channelId: string, bindings: ChannelBinding[]): string[] {
  if (!channelId) return [];
  const fromList = bindings
    .filter((row) => row.enabled && row.listChannelId === channelId)
    .map((row) => row.jid);
  if (fromList.length) return [...new Set(fromList)];
  return [
    ...new Set(
      bindings
        .filter((row) => row.enabled && !row.listChannelId && row.discordChannelId === channelId)
        .map((row) => row.jid),
    ),
  ];
}

export function inboundPrefix(jidCount: number, displayName: string): string {
  if (jidCount <= 1) return '';
  return `**${displayName}**\n`;
}
