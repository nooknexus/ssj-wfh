"use client";

import { Briefcase, CalendarOff, Paperclip, X } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import {
  DAY_PERIOD_LABELS,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_TYPE_LABELS,
  type DayPeriod,
  type ExceptionStatus,
  type ExceptionType,
} from "@/lib/attendance-exception";

export type DayExceptionItem = {
  id: number;
  type: ExceptionType;
  period: DayPeriod;
  status: ExceptionStatus;
  location: string | null;
  reason: string | null;
  attachment_url: string | null;
  reject_reason: string | null;
};

const STATUS_STYLES: Record<ExceptionStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

type DayExceptionBadgeProps = {
  item: DayExceptionItem;
  canCancel: boolean;
};

export const DayExceptionBadge = ({ item, canCancel }: DayExceptionBadgeProps) => {
  const utils = trpc.useUtils();
  const cancelMutation = trpc.attendanceException.cancel.useMutation({
    onSuccess: async () => {
      await utils.attendanceException.listMine.invalidate();
      toast.success("ยกเลิกรายการแล้ว");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCancel = () => {
    void Swal.fire({
      title: "ยกเลิกรายการนี้?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยกเลิกรายการ",
      cancelButtonText: "ปิด",
      confirmButtonColor: "#ef4444",
    }).then((result) => {
      if (result.isConfirmed) cancelMutation.mutate({ id: item.id });
    });
  };

  const Icon = item.type === "official_trip" ? Briefcase : CalendarOff;
  const isActive = item.status === "pending" || item.status === "approved";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
      <Icon className="h-4 w-4 text-slate-500" />
      <span className="font-medium text-slate-800">
        {EXCEPTION_TYPE_LABELS[item.type]} {DAY_PERIOD_LABELS[item.period]}
      </span>
      {item.location ? <span className="text-slate-500">· {item.location}</span> : null}
      <Badge className={`${STATUS_STYLES[item.status]} border-0`}>{EXCEPTION_STATUS_LABELS[item.status]}</Badge>
      {item.attachment_url ? (
        <a href={item.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Paperclip className="h-3 w-3" />
          ไฟล์แนบ
        </a>
      ) : null}
      {item.status === "rejected" && item.reject_reason ? (
        <span className="w-full text-xs text-rose-600">เหตุผล: {item.reject_reason}</span>
      ) : null}
      {canCancel && isActive ? (
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-rose-600 hover:bg-rose-50" onClick={handleCancel} disabled={cancelMutation.isPending}>
          <X className="mr-1 h-3 w-3" />
          ยกเลิก
        </Button>
      ) : null}
    </div>
  );
};
