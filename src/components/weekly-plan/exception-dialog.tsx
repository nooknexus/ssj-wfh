"use client";

import { useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Briefcase, CalendarOff, Paperclip } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import {
  DAY_PERIODS,
  DAY_PERIOD_LABELS,
  EXCEPTION_TYPE_LABELS,
  type DayPeriod,
  type ExceptionType,
} from "@/lib/attendance-exception";

type ExceptionDialogProps = {
  date: Date;
  type: ExceptionType;
  onClose: () => void;
};

const uploadFile = async (file: File): Promise<string> => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body });
  const result = (await response.json()) as { fileUrl?: string; error?: string };
  if (!response.ok || !result.fileUrl) throw new Error(result.error ?? "อัปโหลดไฟล์ไม่สำเร็จ");
  return result.fileUrl;
};

export const ExceptionDialog = ({ date, type, onClose }: ExceptionDialogProps) => {
  const [period, setPeriod] = useState<DayPeriod>("full");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const utils = trpc.useUtils();
  const isTrip = type === "official_trip";

  const createMutation = trpc.attendanceException.create.useMutation({
    onSuccess: async (result) => {
      await utils.attendanceException.listMine.invalidate();
      toast.success(result.status === "approved" ? "บันทึกและอนุมัติแล้ว" : "ส่งคำขอแล้ว รอหัวหน้างานอนุมัติ");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = async () => {
    try {
      setIsUploading(Boolean(file));
      const attachmentUrl = isTrip && file ? await uploadFile(file) : undefined;
      createMutation.mutate({ date, type, period, reason, location: isTrip ? location : undefined, attachmentUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setIsUploading(false);
    }
  };

  const isBusy = isUploading || createMutation.isPending;
  const Icon = isTrip ? Briefcase : CalendarOff;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", isTrip ? "text-indigo-600" : "text-amber-600")} />
            แจ้ง{EXCEPTION_TYPE_LABELS[type]}
          </DialogTitle>
          <DialogDescription>{format(date, "EEEEที่ d MMMM yyyy", { locale: th })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PeriodPicker value={period} onChange={setPeriod} />
          {isTrip ? (
            <div className="space-y-1.5">
              <Label htmlFor="exception-location">สถานที่ไปราชการ</Label>
              <Input id="exception-location" value={location} maxLength={255} onChange={(e) => setLocation(e.target.value)} placeholder="เช่น สสอ.วังทอง" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="exception-reason">{isTrip ? "รายละเอียดภารกิจ" : "เหตุผล"}</Label>
            <Textarea id="exception-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} className="min-h-[80px]" />
          </div>
          {isTrip ? <AttachmentInput file={file} onChange={setFile} /> : null}
          {period !== "full" ? (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              แจ้งครึ่งวัน ช่วงเวลาที่เหลือยังต้องลงเวลาปฏิบัติงานตามปกติ
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isBusy}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={isBusy} className="bg-blue-600 hover:bg-blue-700">
            {isBusy ? "กำลังบันทึก..." : "ส่งคำขอ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PeriodPicker = ({ value, onChange }: { value: DayPeriod; onChange: (period: DayPeriod) => void }) => (
  <div className="space-y-1.5">
    <Label>ช่วงเวลา</Label>
    <div className="grid grid-cols-3 gap-2" role="radiogroup">
      {DAY_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="radio"
          aria-checked={value === period}
          onClick={() => onChange(period)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === period ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
          )}
        >
          {DAY_PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  </div>
);

const AttachmentInput = ({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) => (
  <div className="space-y-1.5">
    <Label htmlFor="exception-file" className="flex items-center gap-1.5">
      <Paperclip className="h-3.5 w-3.5" />
      แนบไฟล์ (ไม่บังคับ) PDF หรือรูปภาพ ไม่เกิน 10MB
    </Label>
    <Input
      id="exception-file"
      type="file"
      accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
      onChange={(e) => onChange(e.target.files?.[0] ?? null)}
    />
    {file ? <p className="text-xs text-slate-500">{file.name}</p> : null}
  </div>
);
