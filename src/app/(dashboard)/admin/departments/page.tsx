"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Building2, Edit, Plus, Ban, CheckCircle2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { DepartmentDialog } from "@/components/admin/department-dialog";
import { toast } from "sonner";

export default function AdminDepartmentsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);

  const { data: departments, isLoading, refetch } = trpc.department.getAll.useQuery();

  const updateMutation = trpc.department.update.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตสถานะสำเร็จ");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAdd = () => {
    setSelectedDept(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (dept: any) => {
    setSelectedDept(dept);
    setIsDialogOpen(true);
  };

  const handleToggleStatus = (dept: any) => {
    const action = dept.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน";
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการ${action}กลุ่มงานนี้?`)) {
      updateMutation.mutate({
        id: dept.id,
        name: dept.name,
        code: dept.code || undefined,
        is_active: !dept.is_active,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          จัดการกลุ่มงาน/ ฝ่าย
        </h1>
        <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2"/>
          เพิ่มกลุ่มงาน
        </Button>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
            <Building2 className="w-5 h-5 text-emerald-600"/>
            รายชื่อกลุ่มงานทั้งหมด
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px] pl-6 font-semibold">รหัส</TableHead>
                <TableHead className="font-semibold">ชื่อกลุ่มงาน</TableHead>
                <TableHead className="text-center font-semibold">จำนวนบุคลากร</TableHead>
                <TableHead className="font-semibold">สถานะ</TableHead>
                <TableHead className="text-right pr-6 font-semibold">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      กำลังโหลดข้อมูล...
                    </div>
                  </TableCell>
                </TableRow>
              ) : departments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-slate-400">
                    ไม่พบข้อมูลกลุ่มงาน
                  </TableCell>
                </TableRow>
              ) : (
                departments?.map((dept: any) => (
                  <TableRow key={dept.id} className="group transition-colors hover:bg-slate-50/80">
                    <TableCell className="pl-6 font-medium text-slate-500">#{dept.id}</TableCell>
                    <TableCell className="font-semibold text-slate-700">
                      <div>
                        {dept.name}
                        {dept.code && <span className="ml-2 text-xs font-normal text-slate-400">({dept.code})</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                        {dept._count.users} คน
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dept.is_active ? (
                        <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200">
                          เปิดใช้งาน
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 border-slate-200">
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleEdit(dept)}
                          className="h-8 w-8 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleToggleStatus(dept)}
                          className={`h-8 w-8 ${
                            dept.is_active 
                              ? "border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700" 
                              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                          title={dept.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        >
                          {dept.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DepartmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        department={selectedDept}
        onSuccess={refetch}
      />
    </div>
  );
}
