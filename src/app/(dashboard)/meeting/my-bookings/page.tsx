"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, MapPin, Users, Info } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { trpc } from "@/trpc/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MyBookingsPage() {
  const { data: bookings, isLoading } = trpc.meeting.getMyBookings.useQuery();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">อนุมัติแล้ว</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">ไม่อนุมัติ</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0">ยกเลิก</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">รออนุมัติ</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">ประวัติการจองห้องประชุม</h1>
          <p className="text-slate-500 mt-1">รายการคำขอจองห้องประชุมทั้งหมดของคุณ</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => window.location.href = "/meeting"}>
          <CalendarIcon className="w-4 h-4 mr-2"/>
          จองห้องประชุมใหม่
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
          <CardTitle className="text-lg flex items-center">
            <Clock className="w-5 h-5 mr-2 text-slate-500"/>
            รายการจองของฉัน
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">หัวข้อการประชุม</TableHead>
                  <TableHead>ห้องประชุม</TableHead>
                  <TableHead>วันและเวลา</TableHead>
                  <TableHead className="text-center">จำนวนผู้เข้าร่วม</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : !bookings || bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500 flex flex-col items-center justify-center">
                      <Info className="w-8 h-8 text-slate-300 mb-2"/>
                      ไม่มีประวัติการจองห้องประชุม
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking: any) => (
                    <TableRow key={booking.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">
                        {booking.title}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-slate-700">
                          <MapPin className="w-4 h-4 mr-1.5 text-slate-400"/>
                          {booking.room?.name || "ไม่ระบุ"}
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
                        <div className="flex items-center justify-center text-slate-600">
                          <Users className="w-4 h-4 mr-1.5 text-slate-400"/>
                          {booking.attendees}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(booking.status)}
                        {booking.status === "rejected" && booking.reject_reason && (
                          <div className="text-xs text-red-500 mt-1 truncate max-w-[150px]" title={booking.reject_reason}>
                            เหตุผล: {booking.reject_reason}
                          </div>
                        )}
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
