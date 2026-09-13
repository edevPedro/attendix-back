-- Drop CRM leftover
DROP TABLE IF EXISTS "Chat";
DROP TABLE IF EXISTS "User";
DROP TABLE IF EXISTS "Attendent";

ALTER TABLE "AllowedChat" ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AllowedChat" ADD COLUMN IF NOT EXISTS "listId" INTEGER;

INSERT INTO "AllowedChat" ("jid", "name", "kind", "enabled", "lastSeen", "createdAt", "updatedAt")
SELECT c."jid", c."name", c."kind", false, c."lastSeen", c."createdAt", c."updatedAt"
FROM "ChatCatalog" c
ON CONFLICT ("jid") DO UPDATE SET "lastSeen" = EXCLUDED."lastSeen";

UPDATE "AllowedChat" AS a
SET "listId" = m."listId",
    "discordChannelId" = NULL
FROM "BroadcastMember" AS m
WHERE a."jid" = m."jid";

DROP TABLE IF EXISTS "BroadcastMember";
DROP TABLE IF EXISTS "ChatCatalog";

ALTER TABLE IF EXISTS "AllowedChat" RENAME TO "WaChat";

ALTER TABLE "WaChat" DROP CONSTRAINT IF EXISTS "WaChat_listId_fkey";
ALTER TABLE "WaChat" ADD CONSTRAINT "WaChat_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BroadcastList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AdminSession" (
    "token" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("token")
);

CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- Fan-out writes several WhatsApp rows for one Discord message.
DROP INDEX IF EXISTS "gateway_messages_discordMessageId_key";
CREATE INDEX IF NOT EXISTS "gateway_messages_discordMessageId_idx" ON "gateway_messages"("discordMessageId");
