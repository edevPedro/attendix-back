export type BaileysRuntime = {
  makeWASocket: any;
  useMultiFileAuthState: any;
  DisconnectReason: Record<string, number>;
  downloadMediaMessage: any;
  jidNormalizedUser: (jid: string) => string;
  Browsers: any;
  proto: any;
};

let cached: BaileysRuntime | null = null;

export async function loadBaileys(): Promise<BaileysRuntime> {
  if (cached) {
    return cached;
  }
  const mod: any = await import('@whiskeysockets/baileys');
  cached = {
    makeWASocket: mod.makeWASocket || mod.default,
    useMultiFileAuthState: mod.useMultiFileAuthState,
    DisconnectReason: mod.DisconnectReason,
    downloadMediaMessage: mod.downloadMediaMessage,
    jidNormalizedUser: mod.jidNormalizedUser,
    Browsers: mod.Browsers,
    proto: mod.proto,
  };
  return cached;
}
