-- 删除 Project.color 和 ProjectCategory.color 字段。
-- 这两个字段历史上用于在 UI 上做色点 / 进度条配色，
-- 但 0.x 版本之后我们改成了纯文字识别（更克制的视觉），字段已彻底无人使用。
-- SQLite 不支持 ALTER TABLE DROP COLUMN（旧 sqlite 版本），统一用 RedefineTable 模式。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Project：去掉 color
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" REAL NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProjectCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("archived", "categoryId", "createdAt", "id", "isDefault", "name", "sortIndex", "updatedAt")
SELECT "archived", "categoryId", "createdAt", "id", "isDefault", "name", "sortIndex", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_archived_sortIndex_idx" ON "Project"("archived", "sortIndex");
CREATE INDEX "Project_categoryId_sortIndex_idx" ON "Project"("categoryId", "sortIndex");

-- ProjectCategory：去掉 color
CREATE TABLE "new_ProjectCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ProjectCategory" ("createdAt", "id", "isDefault", "name", "sortIndex", "updatedAt")
SELECT "createdAt", "id", "isDefault", "name", "sortIndex", "updatedAt" FROM "ProjectCategory";
DROP TABLE "ProjectCategory";
ALTER TABLE "new_ProjectCategory" RENAME TO "ProjectCategory";
CREATE INDEX "ProjectCategory_sortIndex_idx" ON "ProjectCategory"("sortIndex");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
