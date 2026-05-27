-- CreateTable
CREATE TABLE "DailyStatusSnapshot" (
    "date" DATETIME NOT NULL PRIMARY KEY,
    "doing" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "todo" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
