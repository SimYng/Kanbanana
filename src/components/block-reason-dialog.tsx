"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TaskDTO } from "@/lib/types";

interface BlockReasonDialogProps {
  task: TaskDTO | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (taskId: string, reason: string) => Promise<void> | void;
}

export function BlockReasonDialog({
  task,
  onOpenChange,
  onSubmit,
}: BlockReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (task) setReason(task.blockedReason ?? "");
  }, [task]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    const value = reason.trim();
    if (!value) return;
    setBusy(true);
    try {
      await onSubmit(task.id, value);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            标记阻塞
          </DialogTitle>
          <DialogDescription>
            说明被什么卡住，方便自己和团队追踪。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {task && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {task.title}
              <div className="mt-0.5 text-xs text-muted-foreground">
                {task.project.name}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="block-reason">阻塞原因</Label>
            <Textarea
              id="block-reason"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (reason.trim() && !busy) {
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }
              }}
              placeholder="例如：等设计稿小陈出图 / 等后端联调 / 依赖第三方接口"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Ctrl/⌘ + Enter 快速提交
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button type="submit" disabled={busy || !reason.trim()}>
              确认阻塞
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
