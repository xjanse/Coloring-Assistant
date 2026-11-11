/*
  Warnings:

  - You are about to drop the column `imagePath` on the `ColoringProject` table. All the data in the column will be lost.
  - Added the required column `imageKey` to the `ColoringProject` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "StorageQuota" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "reservedBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UploadReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "expectedBytes" BIGINT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ColoringProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ColoringProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ColoringProject" ("createdAt", "id", "title", "updatedAt", "userId") SELECT "createdAt", "id", "title", "updatedAt", "userId" FROM "ColoringProject";
DROP TABLE "ColoringProject";
ALTER TABLE "new_ColoringProject" RENAME TO "ColoringProject";
CREATE UNIQUE INDEX "ColoringProject_imageKey_key" ON "ColoringProject"("imageKey");
CREATE INDEX "ColoringProject_userId_idx" ON "ColoringProject"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UploadReservation_objectKey_key" ON "UploadReservation"("objectKey");

-- CreateIndex
CREATE INDEX "UploadReservation_userId_idx" ON "UploadReservation"("userId");

-- CreateIndex
CREATE INDEX "UploadReservation_expiresAt_idx" ON "UploadReservation"("expiresAt");
