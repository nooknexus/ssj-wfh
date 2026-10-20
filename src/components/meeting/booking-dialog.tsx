"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { combineDateTime, getDefaultBookingRange } from "@/lib/conference-booking";
import { trpc } from "@/trpc/client";
import { LinkCard } from "./link-card";
import { TimeSelect } from "./time-select";

type BookingDialogProps = {
  /** วันที่เริ่มต้นในฟอร์ม (YYYY-MM-DD) */
  initialDate?: string;
  onClose: () => void;
  onBooked?: (date: string) => void;
};

const defaultDate = () => format(addDays(new Date(), 1), "yyyy-MM-dd");

/** ฟอร์มจอง Web Conference ใน modal: เลือกวัน-เวลา, เลือกลิงก์ที่ว่าง, กรอกหัวข้อ */
export const BookingDialog = ({ initialDate, onClose, onBooked }: BookingDialogProps) => {
  const [initialRange] = useState(() => getDefaultBookingRange(initialDate ?? defaultDate(), new Date()));
  const [date, setDate] = useState(initialRange.date);
  const [startTime, setStartTime] = useState(initialRange.start);
  const [endTime, setEndTime] = useState(initialRange.end);
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
      onBooked?.(date);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  // เปลี่ยนวัน/เวลา/จำนวนคนแล้วลิงก์ที่เลือกไว้อาจไม่ว่าง จึงล้างการเลือก
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-indigo-600" />
            จอง Web Conference
          </DialogTitle>
          <DialogDescription>เลือกวันและเวลา แล้วเลือกลิงก์ที่ว่าง คำขอจะรอผู้ดูแล IT อนุมัติ</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">1. วันและเวลา</h3>
          <div className="grid gap-3 sm:grid-cols-4">
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
              <Label htmlFor="booking-attendees">ผู้เข้าร่วม (คน)</Label>
              <Input id="booking-attendees" type="number" min={1} value={attendees} onChange={(e) => resetSelection(setAttendees)(e.target.value)} />
            </div>
          </div>
          {!isTimeValid ? <p className="text-sm text-rose-600">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</p> : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">2. เลือกลิงก์ <span className="font-normal text-slate-500">(เลือกได้เฉพาะลิงก์ที่ว่าง)</span></h3>
          {!isTimeValid || !isAttendeesValid ? (
            <p className="text-sm text-slate-500">กรุณาเลือกวัน เวลา และจำนวนผู้เข้าร่วมให้ถูกต้อง</p>
          ) : isLoading ? (
            <p className="text-sm text-slate-400">กำลังตรวจสอบลิงก์ที่ว่าง...</p>
          ) : !links || links.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีลิงก์ Web Conference ในระบบ กรุณาติดต่อผู้ดูแล IT</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
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
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">3. รายละเอียดการประชุม</h3>
          <div className="space-y-1.5">
            <Label htmlFor="booking-title">หัวข้อการประชุม</Label>
            <Input id="booking-title" value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ประชุมติดตามงานควบคุมโรค" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-description">รายละเอียดเพิ่มเติม (ไม่บังคับ)</Label>
            <Textarea id="booking-description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[72px]" />
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createBooking.isPending}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-blue-600 hover:bg-blue-700">
            {createBooking.isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอจอง"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
