-- Session tokens are now SHA-256 hex; wipe plaintext sessions.
DELETE FROM "AdminSession";

CREATE INDEX IF NOT EXISTS "WaChat_enabled_idx" ON "WaChat"("enabled");
CREATE INDEX IF NOT EXISTS "WaChat_discordChannelId_idx" ON "WaChat"("discordChannelId");
CREATE INDEX IF NOT EXISTS "WaChat_listId_idx" ON "WaChat"("listId");
