"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/fetcher";
import { isoToLocalDate, localDateToIso } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type MemberDTO,
  type ProjectDTO,
  type TaskDTO,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

interface TaskDialogProps {
  task: TaskDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectDTO[];
  members: MemberDTO[];
  onUpdated?: (task: TaskDTO) => void;
  onDeleted?: (taskId: string) => void;
}

export function TaskDialog({
  task,
  open,
  onOpenChange,
  projects,
  members,
  onUpdated,
  onDeleted,
}: TaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [blockedReason, setBlockedReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assigneeId ?? "");
    setProjectId(task.projectId);
    setBlockedReason(task.blockedReason ?? "");
    setDueDate(isoToLocalDate(task.dueDate));
  }, [task]);

  if (!task) return null;

  async function handleSave() {
    if (!task) return;
    setBusy(true);
    try {
      const updated = await apiFetch<TaskDTO>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description,
          status,
          priority,
          assigneeId: assigneeId || null,
          projectId,
          blockedReason: status === "blocked" ? blockedReason : null,
          dueDate: localDateToIso(dueDate),
        }),
      });
      onUpdated?.(updated);
      toast.success("已保存");
      onOpenChange(false);
    } catch (e) {
      toast.error(`保存失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`确认删除任务「${task.title}」？此操作不可撤销。`)) return;
    setBusy(true);
    try {
      await apiFetch<{ ok: true }>(`/api/tasks/${task.id}`, { method: "DELETE" });
      onDeleted?.(task.id);
      toast.success("已删除");
      onOpenChange(false);
    } catch (e) {
      toast.error(`删除失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>任务详情</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">标题</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>项目</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects
                    .filter((p) => !p.archived || p.id === task.projectId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.archived && " (已归档)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>负责人</Label>
              <Select
                value={assigneeId || "_unassigned"}
                onValueChange={(v) => setAssigneeId(v === "_unassigned" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="未分配" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_unassigned">未分配</SelectItem>
                  {members
                    .filter((m) => m.role !== "admin")
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>优先级</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="task-due-date">截止日期</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {status === "blocked" && (
            <div className="grid gap-2">
              <Label>阻塞原因</Label>
              <Input
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                placeholder="例如：等待 XX 出图 / 待运维开通权限"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label>描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="支持 Markdown"
            />
          </div>

          {task.yuqueLinks.length > 0 && (
            <div className="grid gap-2">
              <Label>关联的语雀文档</Label>
              <ul className="space-y-1 text-sm">
                {task.yuqueLinks.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-info hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {link.title ?? link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleDelete} disabled={busy} className="text-destructive">
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={busy || !title.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
