"use client";

import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Briefcase, CalendarOff, CheckCircle, Paperclip, XCircle } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import {
  DAY_PERIOD_LABELS,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_TYPE_LABELS,
  type ExceptionStatus,
} from "@/lib/attendance-exception";

const STATUS_STYLES: Record<ExceptionStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export const ExceptionApprovalsCard = ({ enabled }: { enabled: boolean }) => {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.attendanceException.getDepartmentRequests.useQuery(undefined, { enabled });
  const updateStatus = trpc.attendanceException.updateStatus.useMutation({
    onSuccess: async (_, input) => {
      await utils.attendanceException.getDepartmentRequests.invalidate();
      toast.success(input.status === "approved" ? "อนุมัติเรียบร้อยแล้ว" : "บันทึกการไม่อนุมัติเรียบร้อยแล้ว");
    },
    onError: (error) => void Swal.fire("เกิดข้อผิดพลาด", error.message, "error"),
  });

  const handleApprove = (id: number, name: string) => {
    void Swal.fire({
      title: "ยืนยันการอนุมัติ?",
      text: `อนุมัติคำขอของคุณ ${name} ใช่หรือไม่`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    }).then((result) => {
      if (result.isConfirmed) updateStatus.mutate({ id, status: "approved" });
    });
  };

  const handleReject = (id: number, name: string) => {
    void Swal.fire({
      title: "ไม่อนุมัติคำขอ?",
      text: `ระบุเหตุผลที่ไม่อนุมัติคำขอของคุณ ${name}`,
      input: "text",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
      inputValidator: (value) => (value ? undefined : "กรุณาระบุเหตุผล"),
    }).then((result) => {
      if (result.isConfirmed) updateStatus.mutate({ id, status: "rejected", rejectReason: result.value });
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-lg">คำขอลา / ไปราชการ (จากแผนงานรายสัปดาห์)</CardTitle>
        <CardDescription>ข้อยกเว้นการลงเวลาที่รอหัวหน้ากลุ่มงานพิจารณา เรียงจากรายการที่รอดำเนินการ</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-400">กำลังโหลด...</div>
        ) : !requests || requests.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">ไม่มีรายการคำขอในขณะนี้</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="text-xs w-[180px]">ผู้ขอ</TableHead>
                  <TableHead className="text-xs w-[150px]">วันที่</TableHead>
                  <TableHead className="text-xs w-[170px]">ประเภท</TableHead>
                  <TableHead className="text-xs min-w-[220px]">รายละเอียด</TableHead>
                  <TableHead className="text-xs text-center w-[110px]">สถานะ</TableHead>
                  <TableHead className="text-xs text-center w-[150px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((record) => {
                  const name = record.user.name_th || "ไม่ระบุชื่อ";
                  const Icon = record.type === "official_trip" ? Briefcase : CalendarOff;
                  return (
                    <TableRow key={record.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-slate-900">{name}</span>
                          <span className="text-xs text-slate-500">{record.user.position || "ไม่ระบุตำแหน่ง"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {format(new Date(record.date), "EEE d MMM yy", { locale: th })}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <Icon className="h-3.5 w-3.5 text-slate-400" />
                          {EXCEPTION_TYPE_LABELS[record.type]} {DAY_PERIOD_LABELS[record.period]}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="space-y-0.5 text-sm text-slate-600">
                          {record.location ? <p>สถานที่: {record.location}</p> : null}
                          <p className="line-clamp-2">{record.reason || "-"}</p>
                          {record.attachment_url ? (
                            <a href={record.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <Paperclip className="h-3 w-3" />
                              ไฟล์แนบ
                            </a>
                          ) : null}
                          {record.status === "rejected" && record.reject_reason ? (
                            <p className="text-xs text-rose-600">เหตุผลที่ไม่อนุมัติ: {record.reject_reason}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${STATUS_STYLES[record.status]} border-0`}>{EXCEPTION_STATUS_LABELS[record.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        {record.status === "pending" && record.canApprove ? (
                          <div className="flex justify-center gap-2">
                            <Button size="sm" variant="outline" title="อนุมัติ" disabled={updateStatus.isPending}
                              className="h-8 w-8 p-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => handleApprove(record.id, name)}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" title="ไม่อนุมัติ" disabled={updateStatus.isPending}
                              className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => handleReject(record.id, name)}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-slate-400">
                            {record.status === "pending" ? "รอหัวหน้ากลุ่มงานอนุมัติ" : "-"}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
