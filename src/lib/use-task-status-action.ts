"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetcher";
import { STATUS_LABEL, type TaskDTO, type TaskStatus } from "@/lib/types";

/**
 * 任务状态切换 + 撤销 浮窗 的通用 hook。
 *
 * 设计点：
 *  - 只接管 *快捷* 状态切换（卡片 hover 出的小按钮 / 看板拖列），
 *    不包揽阻塞原因弹窗、不接管拖拽排序的撤销（那是另一类语义）。
 *  - 撤销策略：保存「操作前」的 status / focusedToday / blockedReason 三个字段，
 *    撤销时一次 PATCH 还原；completedAt 由后端基于 status 自动维护，
 *    撤销 done 后会重新写入「撤销那一刻」的 completedAt——这是已知的小代价，
 *    换来不依赖后端「撤销专用接口」。
 *  - Toast 复用全局 sonner，position 在 providers 里统一配置。
 *
 * 用法：
 *   const runAction = useTaskStatusAction({
 *     getTask: (id) => tasks.find((t) => t.id === id),
 *     onPatched: patchLocal,
 *   });
 *   await runAction(taskId, "done");
 */
export interface UseTaskStatusActionArgs {
  /** 从当前内存里取出原始任务，用于构造撤销快照 */
  getTask: (id: string) => TaskDTO | undefined;
  /** 本地状态更新回调（PATCH 成功后写回内存）。撤销成功后也会调用一次。 */
  onPatched: (task: TaskDTO) => void;
}

export function useTaskStatusAction({
  getTask,
  onPatched,
}: UseTaskStatusActionArgs) {
  return useCallback(
    async (taskId: string, next: TaskStatus) => {
      const before = getTask(taskId);
      if (!before) {
        toast.error("任务已不存在，请刷新页面");
        return;
      }
      if (before.status === next) return;

      const snapshot = {
        status: before.status,
        focusedToday: before.focusedToday,
        blockedReason: before.blockedReason,
      };

      try {
        const payload: Record<string, unknown> = { status: next };
        // 切到非阻塞状态时主动清原因；切到 blocked 走专门的对话框，不会进这里。
        if (next !== "blocked") payload.blockedReason = null;

        const updated = await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onPatched(updated);

        toast.success(`已标记为「${STATUS_LABEL[next]}」`, {
          description: before.title,
          duration: 6000,
          action: {
            label: "撤销",
            onClick: async () => {
              try {
                const reverted = await apiFetch<TaskDTO>(
                  `/api/tasks/${taskId}`,
                  {
                    method: "PATCH",
                    body: JSON.stringify(snapshot),
                  },
                );
                onPatched(reverted);
                toast.success("已撤销");
              } catch (err) {
                toast.error(`撤销失败：${(err as Error).message}`);
              }
            },
          },
        });
      } catch (e) {
        toast.error(`更新失败：${(e as Error).message}`);
      }
    },
    [getTask, onPatched],
  );
}
