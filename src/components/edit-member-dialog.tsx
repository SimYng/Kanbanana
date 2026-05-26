"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/fetcher";
import type { MemberDTO, UserRole } from "@/lib/types";

interface EditMemberDialogProps {
  member: MemberDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (m: MemberDTO) => void;
  /** 是否禁用角色切换（例如当前用户没有 admin 权限） */
  canChangeRole?: boolean;
}

export function EditMemberDialog({
  member,
  open,
  onOpenChange,
  onSaved,
  canChangeRole = true,
}: EditMemberDialogProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && member) {
      setName(member.name);
      setRole(member.role);
      setPassword("");
      setShowPwd(false);
    }
  }, [open, member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member || !name.trim()) return;
    if (password && password.length < 6) {
      toast.error("密码至少 6 位");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (name.trim() !== member.name) payload.name = name.trim();
      if (canChangeRole && role !== member.role) payload.role = role;
      if (password) payload.password = password;
      if (Object.keys(payload).length === 0) {
        onOpenChange(false);
        return;
      }
      const updated = await apiFetch<MemberDTO>(`/api/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onSaved?.(updated);
      toast.success("已保存");
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "FORBIDDEN") toast.error("没有权限");
      else if (msg === "LAST_ADMIN") toast.error("至少要保留一个管理员");
      else toast.error(`保存失败：${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑成员</DialogTitle>
          {member && (
            <DialogDescription>
              {member.email} · 邮箱不可修改
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="em-name">姓名</Label>
            <Input
              id="em-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          {canChangeRole && (
            <div className="grid gap-2">
              <Label>角色</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">成员</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="em-pwd">重置密码（留空表示不修改）</Label>
            <div className="relative">
              <Input
                id="em-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="留空保持原密码"
                minLength={6}
                maxLength={100}
                className="pr-9 font-mono"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "隐藏" : "显示"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
            <Button type="submit" disabled={busy || !name.trim()}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
