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

Abra http://localhost:3300 — login com `ADMIN_USER` / `ADMIN_PASSWORD`. Logout invalida a sessão no Postgres (`AdminSession`). O front é servido na mesma origem (CORS fechado por padrão; `CORS_ORIGIN` só se o UI estiver em outro host).

## Modelo

- **WaChat**: catálogo + allowlist num só registro (`enabled` default false). Metadados (jid/nome) podem existir sem captura.
- Canal Discord **1:1** em `WaChat.discordChannelId`. Chat numa **lista** usa só `listId` (o canal é o da `BroadcastList`).
- Mensagens em `gateway_messages`. `waMessageId` é único; `discordMessageId` não é (fan-out de lista gera várias linhas).
- Sem tabelas CRM (`User` / `Attendent` / `Chat`) e sem `BroadcastMember`.

## Discord

Bot com intents **Message Content** + **Guilds**. Permissão de criar canais e enviar mensagens/anexos. `DISCORD_GUILD_ID` e, opcional, `DISCORD_CATEGORY_ID`.

Mensagem no canal da lista vai para todos os JIDs habilitados nela. Inbound compartilhado vem prefixado com o nome.

## WhatsApp

Na aba Conexão, escaneie o QR (aparelho → Aparelhos conectados) ou gere pairing code com DDI+número. Baileys `7.0.0-rc14`. Sessão em `auth_info_baileys/` (não commitar).

## Allowlist

1. Chats conhecidos aparecem no catálogo (só nome/jid) com captura desligada.
2. Ou cole um JID em **Adicionar à lista** (`5511...@s.whatsapp.net` ou `120...@g.us`).
3. Ligue **Captura**. Se o Discord estiver online, um canal 1:1 é criado. Sem Discord, o inbox do front ainda funciona.
4. **Listas** ligam vários JIDs a um canal. O chat deixa de ter canal 1:1 enquanto estiver na lista.

Áudio do WhatsApp é transcrito com Whisper local (`@xenova/transformers`, baixa o modelo na primeira vez). No Discord, `!tts texto` (ou a flag TTS do chat/lista) envia PTT. Dependências: `ffmpeg` e, para TTS, `espeak-ng` ou Piper (`PIPER_BIN` / `PIPER_VOICE`).

## API útil

- `GET /health`
- `POST /admin/login` `{ username, password }`
- `POST /admin/logout` — apaga o cookie e a sessão no banco
- `GET /admin/ready`
- `POST /admin/chats` `{ jid, name?, enabled? }`
- `PATCH /admin/chats/:jid` `{ enabled, sendAsAudio, discordChannelId, broadcastListId }`
- `POST /admin/broadcasts` `{ name, jids?, sendAsAudio? }`
- `POST /admin/inbox/:jid/reply` `{ message }`
