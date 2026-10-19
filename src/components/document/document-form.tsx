"use client";

import { useState } from "react";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { format } from "date-fns";
import { CalendarIcon, Loader2, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  doc_number: z.string().optional(),
  doc_date: z.date(),
  from_to: z.string().min(1, "กรุณาระบุต้นทาง/ปลายทาง"),
  subject: z.string().min(1, "กรุณาระบุเรื่อง"),
  assigned_to: z.string().min(1, "กรุณาเลือกผู้รับผิดชอบ"),
  remark: z.string().optional(),
});

interface DocumentFormProps {
  docType: "inbound" | "outbound";
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DocumentForm({ docType, onSuccess, onCancel }: DocumentFormProps) {
  const router = useRouter();

  // Form state
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState<Date | undefined>(undefined);
  const [fromTo, setFromTo] = useState("");
  const [subject, setSubject] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [remark, setRemark] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get users for assignee dropdown
  const { data: users, isLoading: isLoadingUsers } = trpc.user.listAssignable.useQuery();

  const utils = trpc.useUtils();
  const createDocument = trpc.document.create.useMutation({
    onSuccess: () => {
      Swal.fire({
        icon: "success",
        title: "บันทึกข้อมูลสำเร็จ",
        showConfirmButton: false,
        timer: 1500,
      });
      void utils.document.getDocuments.invalidate();
      if (onSuccess) onSuccess();
      router.refresh();
    },
    onError: (error) => {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: error.message,
      });
      setIsSubmitting(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        Swal.fire({ icon: "error", title: "ไฟล์มีขนาดใหญ่เกินไป", text: "ขนาดไฟล์ต้องไม่เกิน 10MB" });
        e.target.value = "";
        return;
      }
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(selectedFile.type)) {
        Swal.fire({ icon: "error", title: "ประเภทไฟล์ไม่ถูกต้อง", text: "รองรับเฉพาะไฟล์ PDF และรูปภาพเท่านั้น" });
        e.target.value = "";
        return;
      }
      setFile(selectedFile);
    }
  };

  const validate = () => {
    const result = formSchema.safeParse({
      doc_number: docNumber || undefined,
      doc_date: docDate,
      from_to: fromTo,
      subject,
      assigned_to: assignedTo,
      remark: remark || undefined,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      let attachmentSize: number | undefined;
      let attachmentType: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body: formData });
        if (!response.ok) {
          const err = await response.json() as { error?: string };
          throw new Error(err.error ?? "Upload failed");
        }
        const data = await response.json() as { success: boolean; fileUrl: string; fileName: string; fileSize: number; mimeType: string };
        if (data.success) {
          attachmentUrl = data.fileUrl;
          attachmentName = data.fileName;
          attachmentSize = data.fileSize;
          attachmentType = data.mimeType;
        }
      }

      createDocument.mutate({
        doc_type: docType,
        doc_number: docNumber || undefined,
        from_to: fromTo,
        subject,
        doc_date: docDate!,
        assigned_to: parseInt(assignedTo),
        remark: remark || undefined,
        attachments: attachmentUrl
          ? [{ file_name: attachmentName!, file_path: attachmentUrl, file_size: attachmentSize, mime_type: attachmentType }]
          : undefined,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์", text: msg });
      setIsSubmitting(false);
    }
  };

  const isPending = isSubmitting || createDocument.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row 1: เลขที่ + วันที่ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="doc_number">เลขที่เอกสาร</Label>
          <Input
            id="doc_number"
            placeholder="เช่น สธ 0001/123"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>ลงวันที่ (ในเอกสาร) <span className="text-red-500">*</span></Label>
          <Popover>
            <PopoverTrigger
              className={cn(
                "flex h-9 w-full items-center justify-start rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                !docDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {docDate ? format(docDate, "dd/MM/yyyy") : "เลือกวันที่"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={docDate} onSelect={setDocDate} initialFocus />
            </PopoverContent>
          </Popover>
          {errors.doc_date && <p className="text-xs text-red-500">{errors.doc_date}</p>}
        </div>
      </div>

      {/* จาก/ถึง */}
      <div className="space-y-1.5">
        <Label htmlFor="from_to">
          {docType === "inbound" ? "จาก (หน่วยงานต้นทาง)" : "ถึง (หน่วยงานปลายทาง)"}
          <span className="text-red-500"> *</span>
        </Label>
        <Input
          id="from_to"
          placeholder="เช่น กรมควบคุมโรค"
          value={fromTo}
          onChange={(e) => setFromTo(e.target.value)}
        />
        {errors.from_to && <p className="text-xs text-red-500">{errors.from_to}</p>}
      </div>

      {/* เรื่อง */}
      <div className="space-y-1.5">
        <Label htmlFor="subject">เรื่อง <span className="text-red-500">*</span></Label>
        <Textarea
          id="subject"
          placeholder="เรื่องตามหน้าเอกสาร"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          rows={2}
        />
        {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
      </div>

      {/* ผู้รับผิดชอบ */}
      <div className="space-y-1.5">
        <Label>ผู้รับผิดชอบ (พนักงาน) <span className="text-red-500">*</span></Label>
        <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกพนักงานผู้รับผิดชอบ" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingUsers ? (
              <SelectItem value="__loading" disabled>กำลังโหลดข้อมูล...</SelectItem>
            ) : (
              users?.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.title_th ? `${user.title_th} ` : ""}
                  {user.name_th ?? user.name_eng ?? `ID: ${user.id}`}
                  {user.department?.name ? ` — ${user.department.name}` : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors.assigned_to && <p className="text-xs text-red-500">{errors.assigned_to}</p>}
      </div>

      {/* หมายเหตุ */}
      <div className="space-y-1.5">
        <Label htmlFor="remark">หมายเหตุ (ถ้ามี)</Label>
        <Textarea
          id="remark"
          placeholder="บันทึกเพิ่มเติม..."
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={2}
        />
      </div>

      {/* ไฟล์แนบ */}
      <div className="space-y-1.5">
        <Label>ไฟล์แนบ (PDF หรือรูปภาพ, ไม่เกิน 10MB)</Label>
        <div className="border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 hover:bg-muted/40 transition-colors">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <Input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="max-w-xs cursor-pointer"
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <span>เลือกไฟล์: {file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          บันทึกข้อมูล
        </Button>
      </div>
    </form>
  );
}
