"use client";

import { AttendanceCard } from "@/components/attendance/attendance-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Plus, FileText, Calendar as CalendarIcon, Clock, Info, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ModuleGuard } from "@/components/layout/module-guard";
import { ApprovalsButton } from "@/components/attendance/approvals-button";

export default function AttendancePage() {
  const { data: history, isLoading: isHistoryLoading } = trpc.attendance.getHistory.useQuery({ limit: 10 });
  const { data: wfhRecords, isLoading: isWfhLoading } = trpc.wfh.getUserRequests.useQuery();

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
    <ModuleGuard moduleKey="module_attendance">
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* ... existing content ... */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ระบบลงเวลาปฏิบัติงาน
          </h1>
          <ApprovalsButton />
        </div>

        <div className="grid gap-8">
          {/* แจ้งเตือน: ไปราชการ/ลา ให้แจ้งที่แผนงานล่วงหน้ารายสัปดาห์ */}
          <Link
            href="/weekly-plan"
            className="group flex items-center gap-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100/70 hover:border-amber-300 transition-colors"
          >
            <div className="p-3 rounded-xl bg-white text-amber-600 shadow-sm shrink-0">
              <Info className="w-5 h-5"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-amber-900">กรณีไปราชการหรือลา</p>
              <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
                กรุณาแจ้งที่เมนู <span className="font-semibold">แผนงานล่วงหน้ารายสัปดาห์</span>
              </p>
            </div>
            <span className="hidden sm:flex items-center gap-1 text-xs font-bold text-amber-700 whitespace-nowrap group-hover:gap-2 transition-all">
              ไปที่แผนงาน
              <ChevronRight className="w-4 h-4"/>
            </span>
            <ChevronRight className="sm:hidden w-5 h-5 text-amber-600 shrink-0"/>
          </Link>

          {/* Attendance Check-in/out Card */}
          <AttendanceCard/>

          {/* WFH Section - Before Attendance History as requested */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <div className="space-y-0.5">
                <CardTitle className="text-lg">การขออนุมัติ WFH</CardTitle>
                <p className="text-xs text-slate-500">ประวัติการขอปฏิบัติงานที่บ้าน</p>
              </div>
              <div className="flex gap-2">
                <Link href="/wfh/new">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8">
                    <Plus className="w-3.5 h-3.5 mr-1.5"/>
                    ขออนุมัติ WFH
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isWfhLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : !wfhRecords || wfhRecords.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-20"/>
                  <p className="text-sm">ไม่มีประวัติการขอ WFH</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="text-xs uppercase">วันที่ยื่นคำขอ</TableHead>
                        <TableHead className="text-xs uppercase">ช่วงวันที่</TableHead>
                        <TableHead className="text-xs uppercase text-center">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wfhRecords.slice(0, 5).map((record) => (
                        <TableRow key={record.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-slate-500 text-xs">
                            {format(new Date(record.created_at), "dd MMM yy HH:mm", { locale: th })}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center">
                              <CalendarIcon className="w-3.5 h-3.5 mr-2 text-slate-400"/>
                              {format(new Date(record.start_date), "dd MMM yy", { locale: th })}
                              {new Date(record.start_date).getTime() !== new Date(record.end_date).getTime() && 
                                ` - ${format(new Date(record.end_date), "dd MMM yy", { locale: th })}`
                              }
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(record.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance History */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-lg">ประวัติการลงเวลาล่าสุด</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="text-xs uppercase">วันที่</TableHead>
                    <TableHead className="text-xs uppercase">ประเภทงาน</TableHead>
                    <TableHead className="text-xs uppercase">เวลาเข้า</TableHead>
                    <TableHead className="text-xs uppercase">เวลาออก</TableHead>
                    <TableHead className="text-xs uppercase max-w-[200px]">รายละเอียดงาน</TableHead>
                    <TableHead className="text-xs uppercase text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isHistoryLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        กำลังโหลดข้อมูล...
                      </TableCell>
                    </TableRow>
                  ) : history?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        ไม่พบประวัติการลงเวลา
                      </TableCell>
                    </TableRow>
                  ) : (
                    history?.map((record) => (
                      <TableRow key={record.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-sm">
                          {format(new Date(record.date), "d MMM yy", { locale: th })}
                        </TableCell>
                        <TableCell className="capitalize text-sm">{record.work_type}</TableCell>
                        <TableCell className="text-sm">
                          {record.check_in_time ? format(new Date(record.check_in_time), "HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 max-w-[200px] truncate" title={record.tasks || ""}>
                          {record.tasks || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={record.status === "on_time" ? "outline" : "destructive"} className="font-normal text-[10px]">
                            {record.status === "on_time" ? "ปกติ" : "สาย"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </ModuleGuard>
  );
}
