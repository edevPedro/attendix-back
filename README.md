# Attendix — gateway WhatsApp ↔ Discord (interno)

Ferramenta interna. Nenhum chat é capturado até um admin habilitar. Allowlist default: **0**.

## Produção (Docker)

1. Copie `.env.example` → `.env` e defina **`ADMIN_PASSWORD` forte**.
2. Atrás de HTTPS: `COOKIE_SECURE=true` e, se houver proxy, `TRUST_PROXY=true`.
3. Preencha Discord (`DISCORD_TOKEN`, `DISCORD_GUILD_ID`, opcional `DISCORD_CATEGORY_ID`).
4. Suba:

```bash
docker compose up -d --build
```

Postgres só escuta em `127.0.0.1:5432`. A app publica `3300`. Volumes: sessão Baileys (`attendix_wa`) e `storage` (`attendix_storage`).

Probes: `GET /health` (processo) e `GET /ready` (Postgres; 503 se o DB cair).

`docker compose up -d postgres` ainda serve para desenvolver no host com `pnpm start:dev`.

## Desenvolvimento no host

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm prisma:migrate
pnpm start:dev
```

Abra http://localhost:3300. Login: `ADMIN_USER` / `ADMIN_PASSWORD`. Logout invalida a sessão no Postgres (token no cookie, hash no banco).

## Modelo

- **WaChat**: catálogo + captura (`enabled` default false).
- Canal Discord 1:1 em `discordChannelId`; lista usa `listId` e o canal da `BroadcastList`.
- `gateway_messages`: `waMessageId` único; `discordMessageId` indexado (fan-out).
- Mídia em `storage/media` (nome de ficheiro; teto `MEDIA_MAX_BYTES`; TTL `MEDIA_TTL_HOURS`).

## Operação

- WhatsApp: QR na aba Conexão (não vai no payload o QR bruto). Pairing: DDI+número, 10–15 dígitos. Reconnect com backoff até 60s.
- Discord: login com retry; sem token o gateway WA/inbox continua.
- Áudio: Whisper local + `ffmpeg`; TTS `espeak-ng` ou Piper. Fila de speech limitada.
- Login: 8 falhas / 15 min por IP.
- Não commitar `.env`, `auth_info_baileys/` nem `storage/`.

## API

- `GET /health` · `GET /ready`
- `POST /admin/login` `{ username, password }`
- `POST /admin/logout`
- `GET /admin/ready` (detalhe WA/Discord, autenticado)
- `POST /admin/chats` · `PATCH /admin/chats/:jid`
- `POST /admin/broadcasts` · `DELETE /admin/broadcasts/:id`
- `POST /admin/inbox/:jid/reply` `{ message }`
