"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, CalendarIcon, User, Search } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import Swal from "sweetalert2";
import { Input } from "@/components/ui/input";

export default function AdminWFHPage() {
 // TODO: Replace with tRPC query (getPendingLeaves)
  const pendingLeaves = [
    {
      id: 3,
      user: { name_th: "นายสมชาย ใจดี", position: "นักวิชาการคอมพิวเตอร์" },
      leaveType: { name: "ปฏิบัติงานที่บ้าน (WFH)" },
      start_date: new Date("2026-05-10"),
      end_date: new Date("2026-05-12"),
      days: 3,
      reason: "พัฒนาระบบ WFH",
      status: "PENDING",
      created_at: new Date("2026-04-20T09:15:00"),
    },
    {
      id: 4,
      user: { name_th: "นางสาวสมหญิง รักงาน", position: "นักทรัพยากรบุคคล" },
      leaveType: { name: "ปฏิบัติงานที่บ้าน (WFH)" },
      start_date: new Date("2026-05-15"),
      end_date: new Date("2026-05-15"),
      days: 1,
      reason: "จัดทำข้อมูลเงินเดือน",
      status: "PENDING",
      created_at: new Date("2026-04-20T10:20:00"),
    },
  ];

  const handleApprove = (id: number) => {
    Swal.fire({
      title: "ยืนยันการอนุมัติ?",
      text: "คุณต้องการอนุมัติคำขอนี้ใช่หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",// emerald-500
    }).then((result) => {
      if (result.isConfirmed) {
       // trpc mutation to approve
        Swal.fire("อนุมัติสำเร็จ", "ระบบได้แจ้งเตือนไปยังผู้ขอแล้ว", "success");
      }
    });
  };

  const handleReject = (id: number) => {
    Swal.fire({
      title: "ไม่อนุมัติคำขอ?",
      input: 'textarea',
      inputLabel: 'ระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี)',
      inputPlaceholder: 'กรอกเหตุผลที่นี่...',
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",// red-500
    }).then((result) => {
      if (result.isConfirmed) {
       // trpc mutation to reject with result.value (reason)
        Swal.fire("บันทึกข้อมูลสำเร็จ", "ระบบได้ปฏิเสธคำขอนี้แล้ว", "success");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">อนุมัติการปฏิบัติงานที่บ้าน</h1>
          <p className="text-slate-500 mt-1">รายการคำขอที่รอการตรวจสอบและอนุมัติ</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">คำขอรออนุมัติ ({pendingLeaves.length})</CardTitle>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500"/>
              <Input
                type="search"
                placeholder="ค้นหาชื่อผู้ขอ..."
                className="pl-9 h-9 bg-slate-50"
             />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[200px]">ผู้ขออนุญาต</TableHead>
                  <TableHead>รายละเอียดคำขอ</TableHead>
                  <TableHead className="text-center w-[120px]">จำนวนวัน</TableHead>
                  <TableHead className="text-center w-[120px]">สถานะ</TableHead>
                  <TableHead className="text-right w-[200px]">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      ไม่มีคำขอที่รอการอนุมัติ
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingLeaves.map((leave) => (
                    <TableRow key={leave.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4"/>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{leave.user.name_th}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[150px]">{leave.user.position}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center text-slate-700">
                            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400"/>
                            {format(leave.start_date, "dd MMM yyyy", { locale: th })}
                            {leave.start_date.getTime() !== leave.end_date.getTime() && 
                              ` - ${format(leave.end_date, "dd MMM yyyy", { locale: th })}`
                            }
                          </div>
                          <div className="text-slate-500 truncate max-w-[300px]">
                            เหตุผล: {leave.reason}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {leave.days}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">รอพิจารณา</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => handleApprove(leave.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1"/>
                            อนุมัติ
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleReject(leave.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1"/>
                            ไม่อนุมัติ
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
