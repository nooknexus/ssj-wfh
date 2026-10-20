"use client";

import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarIcon, User, Search, FileText, Info, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Swal from "sweetalert2";

export default function AllLeavesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [isSyncing, setIsSyncing] = useState(false);
  const utils = trpc.useUtils();

  const syncMutation = trpc.leave.syncFromSource.useMutation({
    onSuccess: (data) => {
      setIsSyncing(false);
      Swal.fire({
        title: data.failedCount ? "Sync เสร็จ แต่มีรายการผิดพลาด" : "Sync สำเร็จ",
        text: `อ่านจากระบบลา ${data.fetchedCount} รายการ: เพิ่มใหม่ ${data.createdCount} อัปเดต ${data.updatedCount} ข้าม ${data.skippedCount}${data.failedCount ? ` ผิดพลาด ${data.failedCount}` : ""} รายการ`,
        icon: data.failedCount ? "warning" : "success"
      });
      utils.leave.getAllLeaves.invalidate();
    },
    onError: (error) => {
      setIsSyncing(false);
      Swal.fire("Sync ล้มเหลว", error.message, "error");
    }
  });

  const handleSync = () => {
    setIsSyncing(true);
    syncMutation.mutate();
  };

  const { data, isLoading } = trpc.leave.getAllLeaves.useQuery({
    page,
    limit,
    search: searchTerm,
  });

  const leaves = data?.items;
  const total = data?.total || 0;
  const pages = data?.pages || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">อนุมัติแล้ว</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">ไม่อนุมัติ</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-0">ยกเลิก</Badge>;
      case "step1_approved":
        return <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-0">ผ่านขั้นที่ 1</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">รออนุมัติ</Badge>;
    }
  };

  const handleSearch = (val: string) => {
    setSearchTerm(val);
    setPage(1); // Reset to first page on search
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">รายการลาทั้งหมด (Synced)</h1>
          <p className="text-slate-500 mt-1">ข้อมูลการลาทั้งหมดที่ซิงค์มาจากระบบลา (MySQL)</p>
        </div>
        <Button 
          className="bg-amber-600 hover:bg-amber-700 gap-2 shadow-sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCcw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}/>
          {isSyncing ? "กำลัง Sync..." : "Sync ข้อมูลจากระบบลา"}
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600"/>
              รายการทั้งหมด ({total})
            </CardTitle>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"/>
              <Input
                type="search"
                placeholder="ค้นหาชื่อ หรือ CID..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
             />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[250px]">ผู้ขออนุญาต</TableHead>
                  <TableHead>ประเภทการลา</TableHead>
                  <TableHead>ช่วงวันที่ลา</TableHead>
                  <TableHead className="text-center w-[100px]">จำนวนวัน</TableHead>
                  <TableHead className="text-center w-[120px]">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : !leaves || leaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                      ไม่พบข้อมูลการลา
                    </TableCell>
                  </TableRow>
                ) : (
                  leaves.map((leave) => (
                    <TableRow key={leave.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${leave.user ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            <User className="w-4 h-4"/>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {leave.user?.name_th || leave.external_name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded inline-block">
                              {leave.cid || "ไม่ระบุ CID"}
                            </div>
                            {!leave.user && (
                              <div className="text-[10px] text-amber-600 flex items-center mt-0.5">
                                <Info className="w-3 h-3 mr-1"/>
                                ข้อมูลภายนอก (ยังไม่แมตช์ User)
                              </div>
                            )}
                            {leave.user && (
                              <div className="text-xs text-slate-500">{leave.user.position}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {leave.leave_type.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-slate-700">
                          <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400"/>
                          {format(new Date(leave.start_date), "dd MMM yy", { locale: th })}
                          {new Date(leave.start_date).getTime() !== new Date(leave.end_date).getTime() && 
                            ` - ${format(new Date(leave.end_date), "dd MMM yy", { locale: th })}`
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {Number(leave.total_days)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(leave.status)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          {pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t border-slate-100 gap-4">
              <div className="text-sm text-slate-500 order-2 sm:order-1">
                แสดง {(page - 1) * limit + 1} ถึง {Math.min(page * limit, total)} จาก {total} รายการ
              </div>
              <div className="flex items-center gap-1 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ก่อนหน้า
                </Button>
                
                <div className="flex items-center gap-1">
                  {(() => {
                    const delta = 1;
                    const range = [];
                    for (
                      let i = Math.max(2, page - delta);
                      i <= Math.min(pages - 1, page + delta);
                      i++
                    ) {
                      range.push(i);
                    }

                    if (page - delta > 2) {
                      range.unshift("...");
                    }
                    if (page + delta < pages - 1) {
                      range.push("...");
                    }

                    range.unshift(1);
                    if (pages > 1) range.push(pages);

                    return range.map((p, idx) => (
                      <Button
                        key={idx}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0 text-xs",
                          p === page ? "bg-blue-600 hover:bg-blue-700" : "",
                          p === "..." ? "border-none hover:bg-transparent cursor-default" : ""
                        )}
                        onClick={() => typeof p === 'number' && setPage(p)}
                        disabled={p === "..."}
                      >
                        {p}
                      </Button>
                    ));
                  })()}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
