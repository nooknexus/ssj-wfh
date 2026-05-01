"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, CalendarIcon, Clock, MapPin, Users, User, Search } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import Swal from "sweetalert2";
import { Input } from "@/components/ui/input";
import { trpc } from "@/trpc/client";

export default function AdminMeetingPage() {
  const { data: pendingBookings, isLoading, refetch } = trpc.meeting.getPendingBookings.useQuery();
  const updateStatus = trpc.meeting.updateBookingStatus.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  const handleApprove = (id: number) => {
    Swal.fire({
      title: "ยืนยันการอนุมัติ?",
      text: "คุณต้องการอนุมัติการจองห้องประชุมนี้ใช่หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    }).then((result) => {
      if (result.isConfirmed) {
        updateStatus.mutate({ id, status: "approved" }, {
          onSuccess: () => {
            Swal.fire("อนุมัติสำเร็จ", "ระบบได้แจ้งเตือนไปยังผู้จองแล้ว", "success");
          },
          onError: (error) => {
            Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
          }
        });
      }
    });
  };

  const handleReject = (id: number) => {
    Swal.fire({
      title: "ไม่อนุมัติการจอง?",
      input: 'textarea',
      inputLabel: 'ระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี)',
      inputPlaceholder: 'เช่น ห้องประชุมซ่อมบำรุง, มีการจองซ้ำ...',
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (result.isConfirmed) {
        updateStatus.mutate({ id, status: "rejected", rejectReason: result.value }, {
          onSuccess: () => {
            Swal.fire("บันทึกข้อมูลสำเร็จ", "ระบบได้ปฏิเสธการจองนี้แล้ว", "success");
          },
          onError: (error) => {
            Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
          }
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">อนุมัติการจองห้องประชุม</h1>
          <p className="text-slate-500 mt-1">รายการคำขอจองห้องประชุมที่รอการพิจารณา</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">คำขอรออนุมัติ ({pendingBookings?.length || 0})</CardTitle>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500"/>
              <Input
                type="search"
                placeholder="ค้นหาชื่อผู้จอง หรือหัวข้อการประชุม..."
                className="pl-9 h-9 bg-white"
             />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">ผู้จอง</TableHead>
                  <TableHead>รายละเอียดการประชุม</TableHead>
                  <TableHead>วันและเวลา</TableHead>
                  <TableHead className="text-center w-[120px]">สถานะ</TableHead>
                  <TableHead className="text-right w-[200px]">การดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : !pendingBookings || pendingBookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      ไม่มีคำขอที่รอการอนุมัติ
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingBookings.map((booking: any) => (
                    <TableRow key={booking.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4"/>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{booking.user?.name_th || "ไม่ทราบชื่อ"}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[150px]">{booking.user?.position || "ไม่ระบุตำแหน่ง"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{booking.title}</div>
                          <div className="flex items-center text-xs text-slate-500">
                            <MapPin className="w-3 h-3 mr-1"/>
                            {booking.room?.name || "ไม่ระบุห้อง"}
                          </div>
                          <div className="flex items-center text-xs text-slate-500">
                            <Users className="w-3 h-3 mr-1"/>
                            ผู้เข้าร่วม {booking.attendees} คน
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center text-slate-700">
                            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400"/>
                            {format(new Date(booking.date), "dd MMM yyyy", { locale: th })}
                          </div>
                          <div className="flex items-center text-slate-500">
                            <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400"/>
                            {format(new Date(booking.start_time), "HH:mm")} - {format(new Date(booking.end_time), "HH:mm")} น.
                          </div>
                        </div>
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
                            onClick={() => handleApprove(booking.id)}
                            disabled={updateStatus.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1"/>
                            อนุมัติ
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleReject(booking.id)}
                            disabled={updateStatus.isPending}
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
