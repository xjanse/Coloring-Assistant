-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StorageQuota" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "reservedBytes" BIGINT NOT NULL DEFAULT 0,
    "aiGenerationsToday" INTEGER NOT NULL DEFAULT 0,
    "aiUsageDate" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StorageQuota" ("id", "reservedBytes", "updatedAt", "usedBytes") SELECT "id", "reservedBytes", "updatedAt", "usedBytes" FROM "StorageQuota";
DROP TABLE "StorageQuota";
ALTER TABLE "new_StorageQuota" RENAME TO "StorageQuota";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
