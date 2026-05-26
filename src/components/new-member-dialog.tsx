"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function NewMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [role, setRole] = useState<UserRole>("member");
  const [showPwd, setShowPwd] = useState(true);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPassword(randomPassword());
    setRole("member");
    setShowPwd(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setBusy(true);
    try {
      const created = await apiFetch<MemberDTO>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });
      toast.success(`已创建：${created.name}（${created.email}）`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "EMAIL_TAKEN") toast.error("该邮箱已被使用");
      else if (msg === "FORBIDDEN") toast.error("只有管理员可以创建成员");
      else if (msg === "INVALID_INPUT")
        toast.error("输入有误，请检查姓名、邮箱、密码是否合法");
      else toast.error(`创建失败：${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          新增成员
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增成员</DialogTitle>
          <DialogDescription>
            创建账号后请把初始密码告知成员，他登录后可自行修改。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="m-name">姓名</Label>
            <Input
              id="m-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：小李"
              maxLength={50}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="m-email">邮箱（登录用）</Label>
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="li@local"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="m-pwd">初始密码</Label>
              <div className="relative">
                <Input
                  id="m-pwd"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  maxLength={100}
                  className="pr-9 font-mono"
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
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">密码至少 6 位</span>
            <button
              type="button"
              onClick={() => setPassword(randomPassword())}
              className="text-info hover:underline"
            >
              重新生成密码
            </button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                busy || !name.trim() || !email.trim() || password.length < 6
              }
            >
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
