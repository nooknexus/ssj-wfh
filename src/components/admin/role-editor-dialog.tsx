"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/trpc/client";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/lib/roles";

type RoleEditorDialogProps = {
  userId: number;
  userName: string;
  currentRoles: AssignableRole[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const toggleRole = (roles: AssignableRole[], role: AssignableRole): AssignableRole[] =>
  roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];

export const RoleEditorDialog = ({ userId, userName, currentRoles, open, onOpenChange }: RoleEditorDialogProps) => {
  const [selected, setSelected] = useState<AssignableRole[]>(currentRoles);
  const utils = trpc.useUtils();

  const setRoles = trpc.user.setRoles.useMutation({
    onSuccess: async () => {
      await utils.user.getAll.invalidate();
      toast.success("อัปเดตบทบาทสำเร็จ");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            กำหนดบทบาท
          </DialogTitle>
          <DialogDescription>{userName} เลือกได้มากกว่าหนึ่งบทบาท</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <RoleRow id={`role-${userId}-staff`} label={ROLE_LABELS.staff} hint="ทุกคนมีบทบาทนี้โดยปริยาย" checked disabled />
          {ASSIGNABLE_ROLES.map((role) => (
            <RoleRow
              key={role}
              id={`role-${userId}-${role}`}
              label={ROLE_LABELS[role]}
              checked={selected.includes(role)}
              onToggle={() => setSelected((prev) => toggleRole(prev, role))}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={setRoles.isPending}
            onClick={() => setRoles.mutate({ userId, roles: selected })}
          >
            {setRoles.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type RoleRowProps = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
};

const RoleRow = ({ id, label, hint, checked, disabled, onToggle }: RoleRowProps) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </Label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
    <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onToggle} />
  </div>
);
