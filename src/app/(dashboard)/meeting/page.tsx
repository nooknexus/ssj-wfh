"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { ListChecks, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModuleGuard } from "@/components/layout/module-guard";
import { DaySchedule } from "@/components/meeting/day-schedule";
import { LinkCard } from "@/components/meeting/link-card";
import { TimeSelect } from "@/components/meeting/time-select";
import { combineDateTime } from "@/lib/conference-booking";
import { trpc } from "@/trpc/client";

export default function MeetingBookingPage() {
  const router = useRouter();
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendees, setAttendees] = useState("10");
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const startAt = useMemo(() => combineDateTime(date, startTime), [date, startTime]);
  const endAt = useMemo(() => combineDateTime(date, endTime), [date, endTime]);
  const attendeeCount = Number(attendees);
  const isTimeValid = Boolean(startAt && endAt && endAt > startAt);
  const isAttendeesValid = Number.isInteger(attendeeCount) && attendeeCount > 0;

  const { data: links, isLoading } = trpc.meeting.getAvailableLinks.useQuery(
    { startAt: startAt ?? new Date(), endAt: endAt ?? new Date(), attendees: isAttendeesValid ? attendeeCount : 1 },
    { enabled: isTimeValid && isAttendeesValid },
  );

  const utils = trpc.useUtils();
  const createBooking = trpc.meeting.createBooking.useMutation({
    onSuccess: async () => {
      await utils.meeting.invalidate();
      toast.success("ส่งคำขอจองแล้ว รอผู้ดูแล IT อนุมัติ");
      router.push("/meeting/my-bookings");
    },
    onError: (error) => toast.error(error.message),
  });

  // เปลี่ยนวัน/เวลาแล้วลิงก์ที่เลือกไว้อาจไม่ว่าง จึงล้างการเลือก
  const resetSelection = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setSelectedLinkId(null);
  };

  const selectedLink = links?.find((link) => link.id === selectedLinkId && link.availability === "available");
  const canSubmit = Boolean(selectedLink && title.trim() && isTimeValid && isAttendeesValid && !createBooking.isPending);

  const handleSubmit = () => {
    if (!selectedLink || !startAt || !endAt) return;
    createBooking.mutate({ linkId: selectedLink.id, title, description: description || undefined, startAt, endAt, attendees: attendeeCount });
  };

  return (
    <ModuleGuard moduleKey="module_meeting">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <Video className="h-6 w-6 text-indigo-600" />
              จอง Web Conference
            </h1>
            <p className="mt-1 text-slate-500">เลือกวันและเวลา แล้วเลือกลิงก์ที่ว่าง คำขอจะรอผู้ดูแล IT อนุมัติ</p>
          </div>
          <Link href="/meeting/my-bookings">
            <Button variant="outline">
              <ListChecks className="mr-2 h-4 w-4" />
              การจองของฉัน
            </Button>
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg">1. เลือกวันและเวลา</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="booking-date">วันที่</Label>
              <Input id="booking-date" type="date" value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => resetSelection(setDate)(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-start">เวลาเริ่ม</Label>
              <TimeSelect id="booking-start" value={startTime} onChange={resetSelection(setStartTime)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-end">เวลาสิ้นสุด</Label>
              <TimeSelect id="booking-end" value={endTime} onChange={resetSelection(setEndTime)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-attendees">จำนวนผู้เข้าร่วม (คน)</Label>
              <Input id="booking-attendees" type="number" min={1} value={attendees} onChange={(e) => resetSelection(setAttendees)(e.target.value)} />
            </div>
            {!isTimeValid ? <p className="text-sm text-rose-600 sm:col-span-2 lg:col-span-4">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</p> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg">2. เลือกลิงก์</CardTitle>
            <CardDescription>กดเลือกได้เฉพาะลิงก์ที่ว่างในช่วงเวลานี้</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {!isTimeValid || !isAttendeesValid ? (
              <p className="text-sm text-slate-500">กรุณาเลือกวัน เวลา และจำนวนผู้เข้าร่วมให้ถูกต้อง</p>
            ) : isLoading ? (
              <p className="text-sm text-slate-400">กำลังตรวจสอบลิงก์ที่ว่าง...</p>
            ) : !links || links.length === 0 ? (
              <p className="text-sm text-slate-500">ยังไม่มีลิงก์ Web Conference ในระบบ กรุณาติดต่อผู้ดูแล IT</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((link) => (
                  <LinkCard
                    key={link.id}
                    name={link.name}
                    platform={link.platform}
                    maxParticipants={link.max_participants}
                    description={link.description}
                    availability={link.availability}
                    selected={link.id === selectedLinkId}
                    onSelect={() => setSelectedLinkId(link.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg">3. รายละเอียดการประชุม</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="booking-title">หัวข้อการประชุม</Label>
              <Input id="booking-title" value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ประชุมติดตามงานควบคุมโรค" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-description">รายละเอียดเพิ่มเติม (ไม่บังคับ)</Label>
              <Textarea id="booking-description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-blue-600 hover:bg-blue-700">
                {createBooking.isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอจอง"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <DaySchedule date={combineDateTime(date, "00:00")} />
      </div>
    </ModuleGuard>
  );
}
