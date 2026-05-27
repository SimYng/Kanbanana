-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("archived", "color", "createdAt", "id", "name", "sortIndex", "updatedAt") SELECT "archived", "color", "createdAt", "id", "name", "sortIndex", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_archived_sortIndex_idx" ON "Project"("archived", "sortIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 初始化「杂事」默认项目（若尚不存在）。
-- 用途：收纳零散小任务，避免为每件小事单独开项目；应用层禁止删除 / 归档。
-- sortIndex=0 让其排在项目列表最前；id 用可读固定串便于排查（同时 isDefault=1 是真正的判定依据）。
INSERT INTO "Project" ("id", "name", "color", "archived", "isDefault", "sortIndex", "createdAt", "updatedAt")
SELECT 'default-misc', '杂事', 'gray', 0, 1, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Project" WHERE "isDefault" = 1);
