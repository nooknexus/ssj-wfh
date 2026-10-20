"use client";

import { useState } from "react";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HR_ROLES, hasAnyRole } from "@/lib/roles";
import { trpc } from "@/trpc/client";

/** เลือกเดือนและกลุ่มงาน แล้วเปิดหน้าพิมพ์แบบรายงานการลงเวลาในแท็บใหม่ */
export const MonthlyReportDialog = ({ onClose }: { onClose: () => void }) => {
  const { data: session } = useSession();
  // หัวหน้างานที่ไม่ใช่ HR ถูกจำกัดให้เห็นเฉพาะกลุ่มงานตัวเอง (server บังคับซ้ำ)
  const seesAllDepartments = hasAnyRole(session?.user?.roles, HR_ROLES);
  const { data: departments } = trpc.department.getAll.useQuery(undefined, { enabled: seesAllDepartments });
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [departmentId, setDepartmentId] = useState("");

  const canOpen = Boolean(month) && (!seesAllDepartments || Boolean(departmentId));

  const handleOpen = () => {
    const params = new URLSearchParams({ month });
    if (seesAllDepartments) params.set("department", departmentId);
    window.open(`/print/attendance-monthly?${params.toString()}`, "_blank", "noopener");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            พิมพ์แบบรายงานประจำเดือน
          </DialogTitle>
          <DialogDescription>แบบรายงานการลงเวลาปฏิบัติราชการของเจ้าหน้าที่ (A4 แนวนอน) บันทึกเป็น PDF ได้จากหน้าพิมพ์</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-month">ประจำเดือน</Label>
            <Input id="report-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-department">กลุ่มงาน</Label>
            {seesAllDepartments ? (
              <Select value={departmentId} onValueChange={(value) => setDepartmentId(value ?? "")}>
                <SelectTrigger id="report-department" className="w-full">
                  <SelectValue placeholder="เลือกกลุ่มงาน">
                    {departments?.find((dept) => String(dept.id) === departmentId)?.name ?? "เลือกกลุ่มงาน"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                เฉพาะกลุ่มงานของท่าน
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canOpen} onClick={handleOpen}>เปิดหน้าพิมพ์</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
