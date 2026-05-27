-- 删除 Task.priority 字段。
-- priority 历史上是 P0-P3 客观重要性维度，与 sortIndex「个人执行顺序」双轨；
-- 实际使用中信息密度过大、与拖拽顺序高度冗余，已彻底从产品中去掉。
-- SQLite 不支持简单的 ALTER TABLE DROP COLUMN（老版本），统一用 RedefineTable。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "sortIndex" REAL NOT NULL DEFAULT 0,
    "focusedToday" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Task" (
    "id", "title", "description", "projectId", "assigneeId", "creatorId",
    "status", "sortIndex", "focusedToday", "blockedReason", "dueDate",
    "completedAt", "createdAt", "updatedAt"
)
SELECT
    "id", "title", "description", "projectId", "assigneeId", "creatorId",
    "status", "sortIndex", "focusedToday", "blockedReason", "dueDate",
    "completedAt", "createdAt", "updatedAt"
FROM "Task";

DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";

CREATE INDEX "Task_assigneeId_sortIndex_idx" ON "Task"("assigneeId", "sortIndex");
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");
CREATE INDEX "Task_status_idx" ON "Task"("status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
