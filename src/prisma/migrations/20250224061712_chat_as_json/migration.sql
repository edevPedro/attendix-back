/*
  Warnings:

  - The `message` column on the `Chat` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Chat" DROP COLUMN "message",
ADD COLUMN     "message" JSONB NOT NULL DEFAULT '[]';
