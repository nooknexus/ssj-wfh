"use client";

import { useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, ListChecks, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleGuard } from "@/components/layout/module-guard";
import { BookingDialog } from "@/components/meeting/booking-dialog";
import { DaySchedule } from "@/components/meeting/day-schedule";
import { combineDateTime } from "@/lib/conference-booking";

const toDateString = (date: Date) => format(date, "yyyy-MM-dd");

export default function MeetingBookingPage() {
  const [viewDate, setViewDate] = useState(toDateString(new Date()));
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const shiftDay = (days: number) => setViewDate((current) => toDateString(addDays(parseISO(current), days)));

  return (
    <ModuleGuard moduleKey="module_meeting">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <Video className="h-6 w-6 text-indigo-600" />
              ระบบจอง Web Conference
            </h1>
            <p className="mt-1 text-slate-500">ดูตารางการใช้ลิงก์ประชุมออนไลน์ และส่งคำขอจองเพื่อให้ผู้ดูแล IT อนุมัติ</p>
          </div>
          <div className="flex gap-2">
            <Link href="/meeting/my-bookings">
              <Button variant="outline">
                <ListChecks className="mr-2 h-4 w-4" />
                การจองของฉัน
              </Button>
            </Link>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsBookingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              จอง Web Conference
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="วันก่อนหน้า" onClick={() => shiftDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            aria-label="วันที่ที่ต้องการดูตาราง"
            className="w-auto"
            value={viewDate}
            onChange={(e) => e.target.value && setViewDate(e.target.value)}
          />
          <Button variant="outline" size="icon" aria-label="วันถัดไป" onClick={() => shiftDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => setViewDate(toDateString(new Date()))}>
            วันนี้
          </Button>
        </div>

        <DaySchedule date={combineDateTime(viewDate, "00:00")} />
      </div>

      {isBookingOpen ? (
        <BookingDialog
          initialDate={viewDate >= toDateString(new Date()) ? viewDate : undefined}
          onClose={() => setIsBookingOpen(false)}
          onBooked={setViewDate}
        />
      ) : null}
    </ModuleGuard>
  );
}
