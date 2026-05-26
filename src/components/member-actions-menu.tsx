"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { apiFetch } from "@/lib/fetcher";
import type { MemberDTO } from "@/lib/types";

interface MemberActionsMenuProps {
  member: MemberDTO;
  /** 当前登录用户的 id，用于隐藏"删除自己"项 */
  currentUserId?: string;
  onChanged?: () => void;
}

export function MemberActionsMenu({
  member,
  currentUserId,
  onChanged,
}: MemberActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isSelf = currentUserId === member.id;

  async function handleDelete() {
    try {
      await apiFetch(`/api/members/${member.id}`, { method: "DELETE" });
      toast.success(`已删除：${member.name}`);
      onChanged?.();
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "CANNOT_DELETE_SELF") toast.error("不能删除自己");
      else if (msg === "LAST_ADMIN") toast.error("至少要保留一个管理员");
      else if (msg === "HAS_AUTHORED_TASKS")
        toast.error("该成员创建过任务，无法直接删除。请先把这些任务交给其他人。");
      else if (msg === "FORBIDDEN") toast.error("只有管理员可以删除成员");
      else toast.error(`删除失败：${msg}`);
      throw e;
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="成员操作"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            编辑 / 重置密码
          </DropdownMenuItem>
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMemberDialog
        member={editOpen ? member : null}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => {
          onChanged?.();
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        danger
        title={`删除成员「${member.name}」？`}
        description={
          <>
            该成员名下的<strong>任务会保留</strong>但负责人变为空，
            需要管理员重新分配。
            <br />
            此操作不可撤销。
          </>
        }
        confirmLabel="删除"
        onConfirm={handleDelete}
      />
    </>
  );
}
