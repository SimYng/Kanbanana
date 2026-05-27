-- 项目分类（轻概念，用来把同领域的项目折成一组展示）。
-- 1) 建 ProjectCategory 表
-- 2) 先插入「未分类」默认分类（固定 id 便于排查 + API/UI 引用）
-- 3) 重建 Project 表加 categoryId NOT NULL FK，
--    INSERT...SELECT 时把所有现有项目挂到「未分类」下，不丢数据

-- CreateTable
CREATE TABLE "ProjectCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- 初始化「未分类」默认分类（若尚不存在）。
-- id 用可读固定串便于排查；isDefault=1 是真正的判定依据。
-- sortIndex=0 让其默认排在分类列表最前面（用户可拖动调整）。
INSERT INTO "ProjectCategory" ("id", "name", "color", "isDefault", "sortIndex", "createdAt", "updatedAt")
SELECT 'default-category', '未分类', 'gray', 1, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ProjectCategory" WHERE "isDefault" = 1);

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
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProjectCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- 把现有项目一并挂到「未分类」下；用户可在 UI 里自由移动。
INSERT INTO "new_Project" ("archived", "color", "createdAt", "id", "isDefault", "name", "sortIndex", "updatedAt", "categoryId")
SELECT "archived", "color", "createdAt", "id", "isDefault", "name", "sortIndex", "updatedAt", 'default-category' FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_archived_sortIndex_idx" ON "Project"("archived", "sortIndex");
CREATE INDEX "Project_categoryId_sortIndex_idx" ON "Project"("categoryId", "sortIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectCategory_sortIndex_idx" ON "ProjectCategory"("sortIndex");
