-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("archived", "color", "createdAt", "id", "name", "updatedAt") SELECT "archived", "color", "createdAt", "id", "name", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_archived_sortIndex_idx" ON "Project"("archived", "sortIndex");

-- 把现有项目按 (createdAt, id) 顺序灌入梯度 sortIndex（1024, 2048, ...）。
-- 与 lib/sort-index.ts 的 STEP=1024 对齐，避免拖拽首次操作立刻 rebalance。
UPDATE "Project"
SET "sortIndex" = 1024.0 * (
  SELECT COUNT(*)
  FROM "Project" AS p2
  WHERE p2."createdAt" < "Project"."createdAt"
     OR (p2."createdAt" = "Project"."createdAt" AND p2."id" <= "Project"."id")
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
