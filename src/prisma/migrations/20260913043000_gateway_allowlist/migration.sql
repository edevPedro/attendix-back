-- CreateTable
CREATE TABLE "ChatCatalog" (
    "id" SERIAL NOT NULL,
    "jid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedChat" (
    "id" SERIAL NOT NULL,
    "jid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "discordChannelId" TEXT,
    "sendAsAudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastList" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "discordChannelId" TEXT NOT NULL,
    "sendAsAudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastMember" (
    "id" SERIAL NOT NULL,
    "listId" INTEGER NOT NULL,
    "jid" TEXT NOT NULL,

    CONSTRAINT "BroadcastMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_messages" (
    "id" SERIAL NOT NULL,
    "jid" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "mediaPath" TEXT,
    "transcript" TEXT,
    "discordMessageId" TEXT,
    "waMessageId" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatCatalog_jid_key" ON "ChatCatalog"("jid");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedChat_jid_key" ON "AllowedChat"("jid");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastList_discordChannelId_key" ON "BroadcastList"("discordChannelId");

-- CreateIndex
CREATE INDEX "BroadcastMember_jid_idx" ON "BroadcastMember"("jid");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastMember_listId_jid_key" ON "BroadcastMember"("listId", "jid");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_messages_waMessageId_key" ON "gateway_messages"("waMessageId");

-- CreateIndex
CREATE INDEX "gateway_messages_jid_createdAt_idx" ON "gateway_messages"("jid", "createdAt");

-- AddForeignKey
ALTER TABLE "BroadcastMember" ADD CONSTRAINT "BroadcastMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BroadcastList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
