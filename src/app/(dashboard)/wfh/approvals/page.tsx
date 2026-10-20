"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ArrowLeft, CheckCircle, XCircle, CalendarIcon, User as UserIcon } from "lucide-react";
import Link from "next/link";
import Swal from "sweetalert2";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { WFH_APPROVER_ROLES, hasAnyRole } from "@/lib/roles";
import { ExceptionApprovalsCard } from "@/components/attendance/exception-approvals-card";

export default function WfhApprovalsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const utils = trpc.useUtils();
  const canApprove = hasAnyRole(session?.user?.roles, WFH_APPROVER_ROLES);

  const { data: requests, isLoading } = trpc.wfh.getDepartmentRequests.useQuery(undefined, {
    enabled: status === "authenticated" && canApprove,
  });

  const updateStatusMutation = trpc.wfh.updateStatus.useMutation({
    onSuccess: () => {
      utils.wfh.getDepartmentRequests.invalidate();
    },
    onError: (error) => {
      Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
    },
  });

  useEffect(() => {
    if (status === "authenticated" && !canApprove) {
      router.push("/attendance");
    }
  }, [status, canApprove, router]);

  const handleApprove = (id: number, name: string) => {
    Swal.fire({
      title: "ยืนยันการอนุมัติ?",
      text: `คุณต้องการอนุมัติ WFH ของคุณ ${name} ใช่หรือไม่`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#10b981",
    }).then((result) => {
      if (result.isConfirmed) {
        updateStatusMutation.mutate({
          id,
          status: "approved",
        });
        Swal.fire("อนุมัติสำเร็จ!", `อนุมัติ WFH ของคุณ ${name} เรียบร้อยแล้ว`, "success");
      }
    });
  };

  const handleReject = (id: number, name: string) => {
    Swal.fire({
      title: "ไม่อนุมัติ WFH?",
      text: `ระบุเหตุผลที่ไม่อนุมัติ WFH ของคุณ ${name} (ถ้ามี)`,
      input: "text",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ไม่อนุมัติ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
      inputValidator: (value) => {
        if (!value) {
          return 'กรุณาระบุเหตุผล';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        updateStatusMutation.mutate({
          id,
          status: "rejected",
          rejectReason: result.value,
        });
        Swal.fire("บันทึกผลสำเร็จ!", "บันทึกการไม่อนุมัติเรียบร้อยแล้ว", "success");
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">อนุมัติแล้ว</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">ไม่อนุมัติ</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">รออนุมัติ</Badge>;
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/attendance">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4"/>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">การอนุมัติคำขอ</h1>
          <p className="text-slate-500 mt-1">คำขอปฏิบัติงานที่บ้าน และคำขอลา / ไปราชการของบุคลากรในกลุ่มงาน</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg">คำขอปฏิบัติงานที่บ้าน (WFH)</CardTitle>
          <CardDescription>แสดงรายการคำขอทั้งหมด เรียงลำดับจากรายการที่รอดำเนินการ</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!requests || requests.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20"/>
              <p className="text-base font-medium text-slate-500">ไม่มีรายการคำขอในขณะนี้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="text-xs uppercase w-[180px]">ผู้ขอ</TableHead>
                    <TableHead className="text-xs uppercase w-[140px]">วันที่ขอ</TableHead>
                    <TableHead className="text-xs uppercase w-[180px]">ช่วงวันที่ WFH</TableHead>
                    <TableHead className="text-xs uppercase min-w-[200px]">เหตุผล</TableHead>
                    <TableHead className="text-xs uppercase text-center w-[120px]">สถานะ</TableHead>
                    <TableHead className="text-xs uppercase text-center w-[160px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-slate-900">{record.user.name_th || record.user.name_eng || 'ไม่ระบุชื่อ'}</span>
                          <span className="text-xs text-slate-500 truncate max-w-[160px]" title={record.user.position || ""}>
                            {record.user.position || "ไม่ระบุตำแหน่ง"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {format(new Date(record.created_at), "dd MMM yy HH:mm", { locale: th })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center text-slate-700">
                          <CalendarIcon className="w-3.5 h-3.5 mr-2 text-slate-400"/>
                          {format(new Date(record.start_date), "dd MMM yy", { locale: th })}
                          {new Date(record.start_date).getTime() !== new Date(record.end_date).getTime() && 
                            ` - ${format(new Date(record.end_date), "dd MMM yy", { locale: th })}`
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-600 line-clamp-2" title={record.reason || ""}>
                          {record.reason || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(record.status)}
                      </TableCell>
                      <TableCell>
                        {record.status === "pending" && record.canApprove ? (
                          <div className="flex justify-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 w-8 p-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => handleApprove(record.id, record.user.name_th || "ไม่ระบุ")}
                              title="อนุมัติ"
                            >
                              <CheckCircle className="w-4 h-4"/>
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 w-8 p-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleReject(record.id, record.user.name_th || "ไม่ระบุ")}
                              title="ไม่อนุมัติ"
                            >
                              <XCircle className="w-4 h-4"/>
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center text-xs text-slate-400">
                            {record.status === "pending" ? "รอหัวหน้ากลุ่มงานอนุมัติ" : "-"}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExceptionApprovalsCard enabled={status === "authenticated" && canApprove} />
    </div>
  );
}
