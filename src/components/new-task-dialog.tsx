"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  PRIORITY_LABEL,
  TASK_PRIORITIES,
  type MemberDTO,
  type ProjectDTO,
  type TaskDTO,
  type TaskPriority,
} from "@/lib/types";

interface NewTaskDialogProps {
  projects: ProjectDTO[];
  members: MemberDTO[];
  defaultProjectId?: string;
  defaultAssigneeId?: string;
  onCreated?: (task: TaskDTO) => void;
  triggerLabel?: string;
}

export function NewTaskDialog({
  projects,
  members,
  defaultProjectId,
  defaultAssigneeId,
  onCreated,
  triggerLabel = "新建任务",
}: NewTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [yuqueLink, setYuqueLink] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
      setAssigneeId(defaultAssigneeId ?? "");
      setTitle("");
      setDescription("");
      setPriority("P2");
      setYuqueLink("");
    }
  }, [open, defaultProjectId, defaultAssigneeId, projects]);

  async function handleSubmit() {
    if (!title.trim() || !projectId) return;
    setBusy(true);
    try {
      const yuqueLinks = yuqueLink.trim() ? [yuqueLink.trim()] : undefined;
      const created = await apiFetch<TaskDTO>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description || undefined,
          projectId,
          assigneeId: assigneeId || null,
          priority,
          yuqueLinks,
        }),
      });
      onCreated?.(created);
      toast.success("已创建");
      setOpen(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "UNAUTHORIZED")
        toast.error("会话已失效，请重新登录");
      else if (msg === "RELATED_NOT_FOUND")
        toast.error("关联的项目或负责人不存在，请刷新后重试");
      else if (msg === "INVALID_INPUT")
        toast.error("输入有误，请检查必填项");
      else toast.error(`创建失败：${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>标题</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="简短描述要做什么"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>项目</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
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
                  <SelectValue />
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

          <div className="grid gap-2">
            <Label>描述（可选）</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="支持 Markdown"
            />
          </div>

          <div className="grid gap-2">
            <Label>语雀文档链接（可选）</Label>
            <Input
              type="url"
              value={yuqueLink}
              onChange={(e) => setYuqueLink(e.target.value)}
              placeholder="https://www.yuque.com/..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !title.trim() || !projectId}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
