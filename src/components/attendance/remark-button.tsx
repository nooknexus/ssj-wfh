"use client";

import { useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { MessageSquarePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/trpc/client";

const MAX_REMARK_LENGTH = 500;

/** ปุ่มกรอก/แก้ไขหมายเหตุของการลงเวลาหนึ่งรายการ (เช่น เหตุผลที่มาสาย) */
export function RemarkButton({ record }: { record: { id: number; date: Date | string; remark: string | null } }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(record.remark ?? "");
  const utils = trpc.useUtils();
  const updateRemark = trpc.attendance.updateRemark.useMutation({
    onSuccess: () => {
      toast.success("บันทึกหมายเหตุแล้ว");
      utils.attendance.getHistory.invalidate();
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const openDialog = () => {
    setDraft(record.remark ?? "");
    setOpen(true);
  };

  return (
    <>
      {record.remark ? (
        <button
          type="button"
          onClick={openDialog}
          title={record.remark}
          className="group flex max-w-[220px] items-center gap-1.5 text-left text-sm text-slate-600 hover:text-blue-600"
        >
          <span className="truncate">{record.remark}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-600" />
        </button>
      ) : (
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs text-blue-600" onClick={openDialog}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          กรอกหมายเหตุ
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>หมายเหตุการลงเวลา</DialogTitle>
            <DialogDescription>
              วันที่ {format(new Date(record.date), "d MMMM yyyy", { locale: th })} เช่น เหตุผลที่มาสายหรือลงเวลาไม่ได้ตามปกติ
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_REMARK_LENGTH}
            placeholder="ระบุเหตุผล..."
            className="min-h-[110px]"
            autoFocus
          />
          <p className="text-right text-xs text-slate-400">
            {draft.length}/{MAX_REMARK_LENGTH}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={updateRemark.isPending}>
              ยกเลิก
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => updateRemark.mutate({ id: record.id, remark: draft })}
              disabled={updateRemark.isPending}
            >
              {updateRemark.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
