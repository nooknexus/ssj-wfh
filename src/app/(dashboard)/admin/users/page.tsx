"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Search, ShieldCheck, UserPlus, UserX, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import Swal from "sweetalert2";
import { trpc } from "@/trpc/client";
import { getRoleLabel } from "@/lib/roles";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type UserRow = {
  id: number;
  username: string | null;
  name_th: string | null;
  name_eng: string | null;
  title_th: string | null;
  position: string | null;
  hname: string | null;
  email: string | null;
  role: string;
  status: "pending" | "active" | "inactive";
  department_id: number | null;
  created_at: Date;
  department: {
    id: number;
    name: string;
  } | null;
};

const STATUS_STYLES: Record<UserRow["status"], string> = {
  pending: "bg-amber-100 text-amber-700 border-0",
  active: "bg-emerald-100 text-emerald-700 border-0",
  inactive: "bg-slate-200 text-slate-700 border-0",
};

const STATUS_LABELS: Record<UserRow["status"], string> = {
  pending: "รออนุมัติ",
  active: "ใช้งาน",
  inactive: "ระงับการใช้งาน",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();
  
  const { data: users, isLoading } = trpc.user.getAll.useQuery(
    search.trim() ? { search } : undefined,
  );

  const { data: departments } = trpc.department.getAll.useQuery();

  const updateStatus = trpc.user.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.user.getAll.invalidate();
      toast.success("อัปเดตสถานะสำเร็จ");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateDepartment = trpc.user.updateDepartment.useMutation({
    onSuccess: async () => {
      await utils.user.getAll.invalidate();
      toast.success("อัปเดตกลุ่มงานสำเร็จ");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRole = trpc.user.updateRole.useMutation({
    onSuccess: async () => {
      await utils.user.getAll.invalidate();
      toast.success("อัปเดตสิทธิ์สำเร็จ");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = (user: UserRow) => {
    void Swal.fire({
      title: "อนุมัติผู้ใช้งานนี้?",
      text: `บัญชี ${user.name_th ?? user.name_eng ?? user.username ?? `#${user.id}`} จะสามารถเข้าใช้งานระบบได้ทันที`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    }).then((result) => {
      if (!result.isConfirmed) return;

      updateStatus.mutate({ id: user.id, status: "active" });
    });
  };

  const handleDeactivate = (user: UserRow) => {
    void Swal.fire({
      title: "ระงับการใช้งานบัญชีนี้?",
      text: `บัญชี ${user.name_th ?? user.name_eng ?? user.username ?? `#${user.id}`} จะไม่สามารถเข้าใช้งานระบบได้`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ระงับการใช้งาน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (!result.isConfirmed) return;

      updateStatus.mutate({ id: user.id, status: "inactive" });
    });
  };

  const handleDepartmentChange = (userId: number, deptId: string) => {
    const departmentId = deptId === "none" ? null : parseInt(deptId);
    updateDepartment.mutate({ userId, departmentId });
  };

  const handleRoleChange = (userId: number, role: string) => {
    updateRole.mutate({ userId, role: role as any });
  };

  const pendingCount = users?.filter((user) => user.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            จัดการผู้ใช้งาน
          </h1>
          <p className="mt-1 text-slate-500">
            ตรวจสอบผู้ใช้งานใหม่ อนุมัติบัญชี และจัดการสถานะการเข้าใช้งาน
          </p>
        </div>
        <Button className="bg-blue-600" disabled title="เพิ่มผ่าน SSO เท่านั้น">
          <UserPlus className="w-4 h-4 mr-2"/>
          เพิ่มผู้ใช้งาน
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <Input
                className="pl-10"
                placeholder="ค้นหาชื่อ, ตำแหน่ง, หน่วยงาน, อีเมล หรือเลขบัตร..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <ShieldCheck className="h-4 w-4" />
              รออนุมัติ {pendingCount} ราย
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 font-semibold">ชื่อ-นามสกุล</TableHead>
                <TableHead className="font-semibold">ตำแหน่ง</TableHead>
                <TableHead className="font-semibold">กลุ่มงาน/ ฝ่าย</TableHead>
                <TableHead className="font-semibold">สิทธิ์</TableHead>
                <TableHead className="font-semibold text-center">สถานะ</TableHead>
                <TableHead className="text-right pr-6 font-semibold">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      กำลังโหลดข้อมูลผู้ใช้งาน...
                    </div>
                  </TableCell>
                </TableRow>
              ) : !users || users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center text-slate-400">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user: any) => (
                  <TableRow key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-6 whitespace-normal">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900">
                          {user.name_th ?? user.name_eng ?? "ไม่ระบุชื่อ"}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {user.email ?? user.username ?? "ไม่มีข้อมูลติดต่อ"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal text-slate-600 text-sm">
                      {user.position ?? "-"}
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      <Select
                        key={`${user.id}-${user.department_id}`}
                        value={user.department_id?.toString() || "none"}
                        onValueChange={(val) => handleDepartmentChange(user.id, val)}
                        disabled={updateDepartment.isPending}
                      >
                        <SelectTrigger className="h-9 text-sm border-slate-200 bg-white group-hover:border-slate-300 transition-colors">
                          <SelectValue placeholder="เลือกกลุ่มงาน">
                            {user.department?.name || (user.department_id ? `ID: ${user.department_id}` : "เลือกกลุ่มงาน")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
                          {departments?.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Select
                        value={user.role}
                        onValueChange={(val) => handleRoleChange(user.id, val)}
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="h-9 text-sm border-slate-200 bg-white group-hover:border-slate-300 transition-colors">
                          <SelectValue>
                            {getRoleLabel(user.role)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="superadmin">ผู้ดูแลระบบสูงสุด</SelectItem>
                          <SelectItem value="hradmin">ผู้ดูแล HR</SelectItem>
                          <SelectItem value="itadmin">ผู้ดูแล IT</SelectItem>
                          <SelectItem value="leader">หัวหน้างาน</SelectItem>
                          <SelectItem value="staff">เจ้าหน้าที่</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${STATUS_STYLES[user.status as UserRow["status"]]} font-medium whitespace-nowrap`}>
                        {STATUS_LABELS[user.status as UserRow["status"]]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        {user.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                            onClick={() => handleApprove(user)}
                            disabled={updateStatus.isPending}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            อนุมัติ
                          </Button>
                        )}

                        {user.status === "inactive" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                            onClick={() => handleApprove(user)}
                            disabled={updateStatus.isPending}
                          >
                            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                            เปิดใช้งาน
                          </Button>
                        )}

                        {user.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                            onClick={() => handleDeactivate(user)}
                            disabled={updateStatus.isPending}
                          >
                            <UserX className="mr-1.5 h-3.5 w-3.5" />
                            ปิดใช้งาน
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
