"use client";

import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ArrowLeft, Copy, ExternalLink, Plus, Video, X } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleGuard } from "@/components/layout/module-guard";
import { cn } from "@/lib/utils";
import { BOOKING_STATUS_LABELS, PLATFORM_LABELS, type ConferenceBookingStatus } from "@/lib/conference-booking";
import { trpc } from "@/trpc/client";

const STATUS_STYLES: Record<ConferenceBookingStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const copyToClipboard = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("คัดลอกลิงก์แล้ว");
  } catch {
    toast.error("คัดลอกไม่สำเร็จ กรุณาคัดลอกจากปุ่มเปิดลิงก์");
  }
};

export default function MyBookingsPage() {
  const utils = trpc.useUtils();
  const { data: bookings, isLoading } = trpc.meeting.getMyBookings.useQuery();
  const cancelBooking = trpc.meeting.cancelBooking.useMutation({
    onSuccess: async () => {
      await utils.meeting.invalidate();
      toast.success("ยกเลิกการจองแล้ว");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCancel = (id: number, title: string) => {
    void Swal.fire({
      title: "ยกเลิกการจองนี้?",
      text: title,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยกเลิกการจอง",
      cancelButtonText: "ปิด",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (result.isConfirmed) cancelBooking.mutate({ id });
    });
  };

  return (
    <ModuleGuard moduleKey="module_meeting">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/meeting">
              <Button variant="outline" size="icon" className="rounded-full" aria-label="กลับไปหน้าจอง">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">การจองของฉัน</h1>
              <p className="mt-1 text-slate-500">ติดตามสถานะ ลิงก์จะแสดงเมื่อผู้ดูแล IT อนุมัติแล้ว</p>
            </div>
          </div>
          <Link href="/meeting">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              จองใหม่
            </Button>
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg">รายการจอง</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="py-12 text-center text-sm text-slate-400">กำลังโหลด...</p>
            ) : !bookings || bookings.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">ยังไม่มีการจอง</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bookings.map((booking) => {
                  const canCancel = (booking.status === "pending" || booking.status === "approved") && new Date(booking.start_at) > new Date();
                  return (
                    <li key={booking.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{booking.title}</p>
                          <Badge className={cn("border-0", STATUS_STYLES[booking.status])}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          {format(new Date(booking.start_at), "EEE d MMM yy HH:mm", { locale: th })}–{format(new Date(booking.end_at), "HH:mm")} น.
                          {booking.attendees ? ` · ${booking.attendees} คน` : ""}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Video className="h-3.5 w-3.5" />
                          {booking.link.name} ({PLATFORM_LABELS[booking.link.platform]})
                        </p>
                        {booking.status === "rejected" && booking.reject_reason ? (
                          <p className="text-xs text-rose-600">เหตุผลที่ไม่อนุมัติ: {booking.reject_reason}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {booking.link.url ? (
                          <>
                            <a href={booking.link.url} target="_blank" rel="noreferrer">
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                เปิดลิงก์
                              </Button>
                            </a>
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(booking.link.url!)}>
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              คัดลอกลิงก์
                            </Button>
                          </>
                        ) : null}
                        {canCancel ? (
                          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => handleCancel(booking.id, booking.title)} disabled={cancelBooking.isPending}>
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            ยกเลิก
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleGuard>
  );
}
