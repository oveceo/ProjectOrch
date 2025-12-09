/*
  Warnings:

  - You are about to drop the column `ownerEmail` on the `wbs_cache` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "wbs_cache" DROP COLUMN "ownerEmail",
ADD COLUMN     "ownerLastName" TEXT;
