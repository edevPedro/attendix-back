# Attendix — gateway WhatsApp ↔ Discord

Nenhum chat é capturado até um admin habilitar. Default da allowlist: **0**.

## Subir

```bash
cp .env.example .env
# edite ADMIN_PASSWORD, DISCORD_TOKEN, DISCORD_GUILD_ID, DISCORD_CATEGORY_ID

docker compose up -d postgres
pnpm install
pnpm prisma:migrate
pnpm start:dev
```

Abra http://localhost:3300 — login com `ADMIN_USER` / `ADMIN_PASSWORD`. Logout invalida a sessão no servidor. O front é servido na mesma origem (CORS fechado por padrão).

## Discord

No portal de developers: bot com intents **Message Content** e **Server Members** não é necessário; precisa **Message Content** + **Guilds**. Convide o bot para o servidor com permissão de criar canais e enviar mensagens/anexos. Copie o ID do servidor e, opcional, o ID da categoria onde os canais serão criados.

## WhatsApp

Na aba Conexão, escaneie o QR (aparelho → Aparelhos conectados) ou gere pairing code com DDI+número.

## Allowlist

1. Chats conhecidos aparecem no catálogo (só nome/jid).
2. Ou cole um JID em **Adicionar à lista** (`5511...@s.whatsapp.net` ou `120...@g.us`).
3. Ligue **Captura**. Se o Discord estiver online, um canal é criado. Sem Discord, o inbox do front ainda funciona.
4. **Listas** juntam vários JIDs num canal (broadcast). Mensagem no Discord vai para todos; inbound vem prefixado com o nome.

Áudio do WhatsApp é transcrito com Whisper local (baixa o modelo na primeira vez). No Discord, `!tts texto` (ou a flag TTS do chat) envia PTT. Dependências: `ffmpeg` e, para TTS, `espeak-ng` ou Piper.

## API útil

- `GET /health`
- `POST /admin/login` `{ username, password }`
- `GET /admin/ready`
- `POST /admin/chats` `{ jid, name?, enabled? }`
- `PATCH /admin/chats/:jid` `{ enabled, sendAsAudio, discordChannelId, broadcastListId }`
