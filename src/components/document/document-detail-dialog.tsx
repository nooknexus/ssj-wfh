"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  FileText,
  Download,
  User,
  Calendar,
  Hash,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  Play,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Status config
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  new: {
    label: "เอกสารใหม่",
    color: "bg-blue-100 text-blue-700",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  pending: {
    label: "รอเกษียน/สั่งการ",
    color: "bg-amber-100 text-amber-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: "กำลังดำเนินการ",
    color: "bg-purple-100 text-purple-700",
    icon: <Play className="h-3.5 w-3.5" />,
  },
  completed: {
    label: "เสร็จสิ้น",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  inbound: "หนังสือรับ",
  outbound: "หนังสือส่ง",
  order: "คำสั่ง/ประกาศ",
  memo: "บันทึกข้อความ",
};

interface DocumentDetailDialogProps {
  documentId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function DocumentDetailDialog({
  documentId,
  open,
  onClose,
  onUpdated,
}: DocumentDetailDialogProps) {
  const [remark, setRemark] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: doc, isLoading } = trpc.document.getDocument.useQuery(
    { id: documentId! },
    { enabled: !!documentId && open }
  );

  const utils = trpc.useUtils();
  const updateStatus = trpc.document.updateStatus.useMutation({
    onSuccess: () => {
      void utils.document.getDocuments.invalidate();
      void utils.document.getDocument.invalidate({ id: documentId! });
      Swal.fire({
        icon: "success",
        title: "อัปเดตสถานะสำเร็จ",
        showConfirmButton: false,
        timer: 1200,
      });
      setIsUpdating(false);
      setRemark("");
      if (onUpdated) onUpdated();
    },
    onError: (err) => {
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: err.message });
      setIsUpdating(false);
    },
  });

  const handleStatusChange = (
    newStatus: "new" | "pending" | "in_progress" | "completed"
  ) => {
    if (!documentId) return;
    setIsUpdating(true);
    updateStatus.mutate({
      id: documentId,
      status: newStatus,
      remark: remark || undefined,
    });
  };

  const statusConfig = doc ? STATUS_CONFIG[doc.status] : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            รายละเอียดเอกสาร
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !doc ? (
          <div className="text-center py-10 text-muted-foreground">ไม่พบข้อมูลเอกสาร</div>
        ) : (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                </p>
                <h2 className="text-lg font-semibold text-slate-800 leading-snug max-w-[500px]">
                  {doc.subject}
                </h2>
              </div>
              {statusConfig && (
                <Badge
                  className={`${statusConfig.color} flex items-center gap-1.5 px-2.5 py-1`}
                >
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow
                icon={<Hash className="h-4 w-4 text-slate-400" />}
                label="เลขที่เอกสาร"
                value={doc.doc_number ?? "-"}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4 text-slate-400" />}
                label="ลงวันที่"
                value={
                  doc.doc_date
                    ? format(new Date(doc.doc_date), "d MMMM yyyy", { locale: th })
                    : "-"
                }
              />
              <InfoRow
                icon={<ArrowRight className="h-4 w-4 text-slate-400" />}
                label={doc.doc_type === "inbound" ? "จาก" : "ถึง"}
                value={doc.from_to ?? "-"}
              />
              <InfoRow
                icon={<User className="h-4 w-4 text-slate-400" />}
                label="ผู้รับผิดชอบ"
                value={doc.assignee?.name_th ?? doc.assignee?.name_eng ?? "-"}
              />
              <InfoRow
                icon={<User className="h-4 w-4 text-slate-400" />}
                label="ผู้บันทึก"
                value={doc.creator?.name_th ?? doc.creator?.name_eng ?? "-"}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4 text-slate-400" />}
                label="วันที่บันทึก"
                value={format(new Date(doc.created_at), "d MMM yyyy HH:mm", { locale: th })}
              />
            </div>

            {/* Remark */}
            {doc.remark && (
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                <p className="text-xs text-amber-600 font-semibold uppercase mb-1">หมายเหตุ</p>
                <p className="text-sm text-slate-700">{doc.remark}</p>
              </div>
            )}

            {/* Attachments */}
            {doc.attachments && doc.attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">ไฟล์แนบ ({doc.attachments.length} ไฟล์)</p>
                <div className="space-y-2">
                  {doc.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-colors group"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{att.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ""}{" "}
                          {att.mime_type ?? ""}
                        </p>
                      </div>
                      <Download className="h-4 w-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Status Update */}
            <div className="border-t pt-5 space-y-3">
              <p className="text-sm font-semibold text-slate-700">อัปเดตสถานะเอกสาร</p>
              <div className="space-y-1.5">
                <Label htmlFor="remark_update">หมายเหตุเพิ่มเติม (ถ้ามี)</Label>
                <Textarea
                  id="remark_update"
                  placeholder="เกษียนหนังสือ / บันทึกเพิ่มเติม..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {doc.status !== "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={isUpdating}
                    onClick={() => handleStatusChange("pending")}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    รอเกษียน/สั่งการ
                  </Button>
                )}
                {doc.status !== "in_progress" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    disabled={isUpdating}
                    onClick={() => handleStatusChange("in_progress")}
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    กำลังดำเนินการ
                  </Button>
                )}
                {doc.status !== "completed" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={isUpdating}
                    onClick={() => handleStatusChange("completed")}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    เสร็จสิ้น
                  </Button>
                )}
                {isUpdating && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground self-center" />}
              </div>
            </div>

            {/* Close */}
            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={onClose}>
                ปิด
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper component
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
