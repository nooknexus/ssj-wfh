"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/client";
import { toast } from "sonner";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: any;
  onSuccess: () => void;
}

export function DepartmentDialog({ open, onOpenChange, department, onSuccess }: DepartmentDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  const utils = trpc.useContext();

  useEffect(() => {
    if (department) {
      setName(department.name);
      setCode(department.code || "");
      setIsActive(department.is_active);
    } else {
      setName("");
      setCode("");
      setIsActive(true);
    }
  }, [department, open]);

  const createMutation = trpc.department.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มกลุ่มงานสำเร็จ");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.department.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขกลุ่มงานสำเร็จ");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (department) {
      updateMutation.mutate({
        id: department.id,
        name,
        code,
        is_active: isActive,
      });
    } else {
      createMutation.mutate({
        name,
        code,
        is_active: isActive,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{department ? "แก้ไขกลุ่มงาน" : "เพิ่มกลุ่มงานใหม่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อกลุ่มงาน <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น กลุ่มงานยุทธศาสตร์"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">รหัสกลุ่มงาน (ถ้ามี)</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="เช่น STR-01"
            />
          </div>
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="active-status">สถานะการใช้งาน</Label>
              <div className="text-sm text-slate-500">เปิดหรือปิดการแสดงผลในระบบ</div>
            </div>
            <Switch
              id="active-status"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isLoading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
