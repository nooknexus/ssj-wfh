"use client";

import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/trpc/client";
import { BOOKING_STATUS_LABELS, PLATFORM_LABELS } from "@/lib/conference-booking";

/** ตารางการจองของวันที่เลือก (แสดงหัวข้อและเวลา ไม่แสดง URL) */
export const DaySchedule = ({ date }: { date: Date | null }) => {
  const { data: bookings, isLoading } = trpc.meeting.getDaySchedule.useQuery(
    { date: date ?? new Date() },
    { enabled: Boolean(date) },
  );

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-slate-500" />
          ตารางการจอง{date ? ` วัน${format(date, "EEEEที่ d MMMM yyyy", { locale: th })}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : !bookings || bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีการจองในวันนี้</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {bookings.map((booking) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {format(new Date(booking.start_at), "HH:mm")}–{format(new Date(booking.end_at), "HH:mm")} น. · {booking.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {booking.link.name} ({PLATFORM_LABELS[booking.link.platform]})
                  </p>
                </div>
                <Badge className={booking.status === "approved" ? "border-0 bg-emerald-100 text-emerald-700" : "border-0 bg-amber-100 text-amber-700"}>
                  {BOOKING_STATUS_LABELS[booking.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
