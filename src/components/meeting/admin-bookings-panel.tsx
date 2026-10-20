"use client";

import { useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CheckCircle, XCircle } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_LABELS, PLATFORM_LABELS, type ConferenceBookingStatus } from "@/lib/conference-booking";
import { trpc } from "@/trpc/client";

const STATUS_STYLES: Record<ConferenceBookingStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const FILTERS: Array<{ value: ConferenceBookingStatus | "all"; label: string }> = [
  { value: "pending", label: "รออนุมัติ" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "all", label: "ทั้งหมด" },
];

export const AdminBookingsPanel = () => {
  const [filter, setFilter] = useState<ConferenceBookingStatus | "all">("pending");
  const utils = trpc.useUtils();
  const { data: bookings, isLoading } = trpc.meeting.getAllBookings.useQuery(filter === "all" ? undefined : { status: filter });
  const updateStatus = trpc.meeting.updateBookingStatus.useMutation({
    onSuccess: async (_, input) => {
      await utils.meeting.invalidate();
      toast.success(input.status === "approved" ? "อนุมัติการจองแล้ว" : "บันทึกการไม่อนุมัติแล้ว");
    },
    onError: (error) => void Swal.fire("ดำเนินการไม่สำเร็จ", error.message, "error"),
  });

  const handleApprove = (id: number, title: string) => {
    void Swal.fire({ title: "อนุมัติการจองนี้?", text: title, icon: "question", showCancelButton: true, confirmButtonText: "อนุมัติ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#10b981" })
      .then((result) => result.isConfirmed && updateStatus.mutate({ id, status: "approved" }));
  };

  const handleReject = (id: number, title: string) => {
    void Swal.fire({
      title: "ไม่อนุมัติการจอง?",
      text: title,
      input: "text",
      inputPlaceholder: "เหตุผลที่ไม่อนุมัติ",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
      inputValidator: (value) => (value ? undefined : "กรุณาระบุเหตุผล"),
    }).then((result) => result.isConfirmed && updateStatus.mutate({ id, status: "rejected", rejectReason: result.value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 px-6 pt-6">
        {FILTERS.map((item) => (
          <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "outline"} onClick={() => setFilter(item.value)}>
            {item.label}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : !bookings || bookings.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">ไม่มีรายการ</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="pl-6 text-xs">ผู้จอง</TableHead>
                <TableHead className="text-xs">วันเวลา</TableHead>
                <TableHead className="text-xs">ลิงก์</TableHead>
                <TableHead className="min-w-[200px] text-xs">หัวข้อ</TableHead>
                <TableHead className="text-center text-xs">สถานะ</TableHead>
                <TableHead className="pr-6 text-center text-xs">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="pl-6">
                    <p className="text-sm font-medium text-slate-900">{booking.user.name_th ?? "ไม่ระบุชื่อ"}</p>
                    <p className="text-xs text-slate-500">{booking.user.department?.name ?? booking.user.position ?? "-"}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {format(new Date(booking.start_at), "EEE d MMM yy", { locale: th })}
                    <br />
                    {format(new Date(booking.start_at), "HH:mm")}–{format(new Date(booking.end_at), "HH:mm")} น.
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {booking.link.name}
                    <p className="text-xs text-slate-500">{PLATFORM_LABELS[booking.link.platform]} · {booking.attendees ?? "-"} คน</p>
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-slate-700">
                    {booking.title}
                    {booking.reject_reason ? <p className="text-xs text-rose-600">เหตุผล: {booking.reject_reason}</p> : null}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("border-0", STATUS_STYLES[booking.status])}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    {booking.status === "pending" ? (
                      <div className="flex justify-center gap-2">
                        <Button size="sm" variant="outline" title="อนุมัติ" disabled={updateStatus.isPending} className="h-8 w-8 border-emerald-200 p-0 text-emerald-600 hover:bg-emerald-50" onClick={() => handleApprove(booking.id, booking.title)}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" title="ไม่อนุมัติ" disabled={updateStatus.isPending} className="h-8 w-8 border-red-200 p-0 text-red-600 hover:bg-red-50" onClick={() => handleReject(booking.id, booking.title)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-slate-400">-</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
