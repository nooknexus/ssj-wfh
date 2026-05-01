"use client";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Calendar as CalendarIcon, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ModuleGuard } from "@/components/layout/module-guard";

export default function LeavePage() {
  const { data: leaves, isLoading, refetch } = trpc.leave.getUserLeaves.useQuery();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">อนุมัติแล้ว</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">ไม่อนุมัติ</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">รออนุมัติ</Badge>;
    }
  };

  return (
    <ModuleGuard moduleKey="module_leave">
      <div className="space-y-6">
        {/* ... existing content ... */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ระบบลาออนไลน์</h1>
            <p className="text-slate-500 mt-1">จัดการใบลาและติดตามสถานะการลาของคุณ</p>
          </div>
          <div className="flex gap-2">
            <Link href="/leave/new">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2"/>
                ยื่นใบลาใหม่
              </Button>
            </Link>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">ประวัติการลา</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : !leaves || leaves.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                <FileText className="w-12 h-12 text-slate-300 mb-4"/>
                <p>ยังไม่มีประวัติการลา</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่ยื่น</TableHead>
                      <TableHead>ประเภทการลา</TableHead>
                      <TableHead>ช่วงวันที่ลา</TableHead>
                      <TableHead className="text-center">จำนวนวัน</TableHead>
                      <TableHead>เหตุผล/หมายเหตุ</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="text-slate-500 text-xs">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1"/>
                            {format(new Date(leave.created_at), "dd MMM yy HH:mm", { locale: th })}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{leave.leave_type.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center text-slate-700 text-sm">
                            <CalendarIcon className="w-4 h-4 mr-2 text-slate-400"/>
                            {format(new Date(leave.start_date), "dd MMM yy", { locale: th })}
                            {new Date(leave.start_date).getTime() !== new Date(leave.end_date).getTime() && 
                              ` - ${format(new Date(leave.end_date), "dd MMM yy", { locale: th })}`
                            }
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{Number(leave.total_days)}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={leave.reason || ""}>
                          {leave.reason}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(leave.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleGuard>
  );
}
