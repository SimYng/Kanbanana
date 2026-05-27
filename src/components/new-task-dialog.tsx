"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
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
import { NewProjectDialog } from "@/components/new-project-dialog";
import { NewMemberDialog } from "@/components/new-member-dialog";
import { apiFetch } from "@/lib/fetcher";
import { localDateToIso } from "@/lib/utils";
import type {
  MemberDTO,
  ProjectDTO,
  TaskDTO,
} from "@/lib/types";

interface NewTaskDialogProps {
  projects: ProjectDTO[];
  members: MemberDTO[];
  defaultProjectId?: string;
  defaultAssigneeId?: string;
  onCreated?: (task: TaskDTO) => void;
  triggerLabel?: string;
  /** 自定义触发器元素：必须是单个可作为 Radix DialogTrigger asChild 子节点的 ReactElement。
   *  传入则替换默认的 + 文案按钮，便于在列头放小 icon 按钮等场景。 */
  triggerNode?: ReactElement;
  /** 是否在「项目 / 负责人」下拉旁展示「新建」+ 按钮（仅 admin 应启用）。
   *  默认 false：避免无权限用户看到点不动的按钮。 */
  allowCreateRelated?: boolean;
}

export function NewTaskDialog({
  projects,
  members,
  defaultProjectId,
  defaultAssigneeId,
  onCreated,
  triggerLabel = "新建任务",
  triggerNode,
  allowCreateRelated,
}: NewTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [yuqueLink, setYuqueLink] = useState("");
  const [busy, setBusy] = useState(false);

  // 本地副本：内嵌「新建项目 / 新建成员」时把新实体先 append 进来，
  // 不依赖父级 router.refresh 的时序，下拉立刻能选到新值。
  const [localProjects, setLocalProjects] = useState<ProjectDTO[]>(projects);
  const [localMembers, setLocalMembers] = useState<MemberDTO[]>(members);

  // 父级 props 变化（如 router.refresh 后）同步本地副本
  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);
  useEffect(() => {
    setLocalMembers(members);
  }, [members]);

  // 只在「打开瞬间」reset 字段；props.projects 因父级 refresh 变化时不再触发，
  // 避免覆盖用户刚通过 + 按钮新建并选中的项目 / 负责人。
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setProjectId(defaultProjectId ?? localProjects[0]?.id ?? "");
      setAssigneeId(defaultAssigneeId ?? "");
      setTitle("");
      setDescription("");
      setDueDate("");
      setYuqueLink("");
    }
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只依赖 open，避免列表变化覆盖选中
  }, [open]);

  function handleProjectCreated(p: ProjectDTO) {
    setLocalProjects((prev) =>
      prev.some((x) => x.id === p.id) ? prev : [...prev, p],
    );
    setProjectId(p.id);
  }
  function handleMemberCreated(m: MemberDTO) {
    setLocalMembers((prev) =>
      prev.some((x) => x.id === m.id) ? prev : [...prev, m],
    );
    setAssigneeId(m.id);
  }

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
          dueDate: localDateToIso(dueDate),
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
        {triggerNode ?? (
          <Button size="sm" variant="default">
            <Plus className="h-4 w-4" />
            {triggerLabel}
          </Button>
        )}
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
              {/* Select + 「新建项目」按钮同行；新建后自动 append + select */}
              <div className="flex items-center gap-1.5">
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {localProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allowCreateRelated && (
                  <NewProjectDialog
                    onCreated={handleProjectCreated}
                    triggerNode={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label="新建项目"
                        title="新建项目"
                        className="h-9 w-9 shrink-0 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>负责人</Label>
              <div className="flex items-center gap-1.5">
                <Select
                  value={assigneeId || "_unassigned"}
                  onValueChange={(v) =>
                    setAssigneeId(v === "_unassigned" ? "" : v)
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_unassigned">未分配</SelectItem>
                    {localMembers
                      .filter((m) => m.role !== "admin")
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {allowCreateRelated && (
                  <NewMemberDialog
                    onCreated={handleMemberCreated}
                    triggerNode={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label="新增成员"
                        title="新增成员"
                        className="h-9 w-9 shrink-0 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-task-due">截止日期（可选）</Label>
            <Input
              id="new-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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
