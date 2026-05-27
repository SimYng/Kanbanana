-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" DATETIME;

-- 回填：已有 done 任务的完成时间用 updatedAt 近似（无更精确数据）；
-- 上线后 API 会基于 status 切换自动维护该字段。
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'done';
