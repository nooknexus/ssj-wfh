"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, RefreshCw, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import dynamic from "next/dynamic";

// Dynamic import for Map to avoid SSR issues
const MapWithNoSSR = dynamic(() => import("@/components/attendance/location-map"), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

const STATUS_MAP: Record<string, { label: string, color: string }> = {
  on_time: { label: "ตรงเวลา", color: "bg-emerald-100 text-emerald-800" },
  late: { label: "สาย", color: "bg-amber-100 text-amber-800" },
  absent: { label: "ขาด", color: "bg-rose-100 text-rose-800" },
  leave: { label: "ลา", color: "bg-blue-100 text-blue-800" },
  official_trip: { label: "ไปราชการ", color: "bg-indigo-100 text-indigo-800" },
  holiday: { label: "วันหยุด", color: "bg-slate-100 text-slate-800" },
  holiday_work: { label: "มาทำงาน (วันหยุด)", color: "bg-purple-100 text-purple-800" },
};

const WORK_TYPE_MAP: Record<string, string> = {
  office: "Office",
  wfh: "WFH",
  onsite: "Onsite",
};

export default function AdminAttendancePage() {
  const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [workType, setWorkType] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"in" | "out">("in");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const handleShowLocation = (record: any, type: "in" | "out") => {
    setSelectedRecord(record);
    setPreviewType(type);
    setIsPreviewOpen(true);
  };

  const { data: departments } = trpc.department.getAll.useQuery();
  
  const trpcUtils = trpc.useUtils();

  const queryFilters = {
    startDate: dateFrom ? new Date(dateFrom) : undefined,
    endDate: dateTo ? new Date(dateTo) : undefined,
    departmentId: departmentId !== "all" ? Number(departmentId) : undefined,
    status: status !== "all" ? (status as any) : undefined,
    workType: workType !== "all" ? (workType as any) : undefined,
    search: search || undefined,
    page: page,
    limit: 50,
  };

  const { data, isLoading, refetch, error } = trpc.attendance.getAdminRecords.useQuery(queryFilters, {
    retry: false,
    enabled: !!dateFrom && !!dateTo,
  });

  // Reset page when filters change
  const handleFilterChange = (setter: (val: any) => void, val: any) => {
    setter(val);
    setPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await trpcUtils.client.attendance.getAdminRecords.query({
        ...queryFilters,
        fetchAll: true,
      });

      if (!result.items || result.items.length === 0) {
        alert("ไม่มีข้อมูลสำหรับส่งออก");
        return;
      }

      const worksheetData = result.items.map((r) => ({
        "ชื่อ-สกุล": r.user.name_th || r.user.username || "-",
        "กลุ่มงาน": r.user.department?.name || "-",
        "วันที่": format(new Date(r.date), "dd/MM/yyyy"),
        "ประเภทงาน": WORK_TYPE_MAP[r.work_type] || r.work_type,
        "เวลาเข้า": r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "-",
        "เวลาออก": r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "-",
        "สถานะ": STATUS_MAP[r.status]?.label || r.status,
        "รายละเอียดงาน": r.tasks || "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
      XLSX.writeFile(workbook, `attendance_export_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("เกิดข้อผิดพลาดในการส่งออกไฟล์");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">จัดการข้อมูลการลงเวลา</h1>
          <p className="text-slate-500 mt-1">ดูและส่งออกข้อมูลการลงเวลาปฏิบัติงานของบุคลากรทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> รีเฟรช
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            ส่งออก Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-slate-500" />
            <CardTitle className="text-lg font-semibold">ค้นหาและตัวกรอง</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700">วันที่เริ่มต้น</label>
              <Input type="date" value={dateFrom} onChange={(e) => handleFilterChange(setDateFrom, e.target.value)} className="w-full" />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700">วันที่สิ้นสุด</label>
              <Input type="date" value={dateTo} onChange={(e) => handleFilterChange(setDateTo, e.target.value)} className="w-full" />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700">ค้นหาชื่อ/CID</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="ค้นหาชื่อ..." 
                  value={search} 
                  onChange={(e) => handleFilterChange(setSearch, e.target.value)} 
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="text-sm font-medium text-slate-700">กลุ่มงาน</label>
              <Select value={departmentId} onValueChange={(val) => handleFilterChange(setDepartmentId, val || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ทั้งหมด">
                    {departmentId === "all" ? "ทั้งหมด" : departments?.find(d => d.id.toString() === departmentId)?.name || "ทั้งหมด"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">ประเภทงาน</label>
              <Select value={workType} onValueChange={(val) => handleFilterChange(setWorkType, val || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ทั้งหมด">
                    {workType === "all" ? "ทั้งหมด" : WORK_TYPE_MAP[workType] || "ทั้งหมด"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="wfh">WFH</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">สถานะการมาทำงาน</label>
              <Select value={status} onValueChange={(val) => handleFilterChange(setStatus, val || "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ทั้งหมด">
                    {status === "all" ? "ทั้งหมด" : STATUS_MAP[status]?.label || "ทั้งหมด"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="on_time">ตรงเวลา</SelectItem>
                  <SelectItem value="late">สาย</SelectItem>
                  <SelectItem value="absent">ขาด</SelectItem>
                  <SelectItem value="leave">ลา</SelectItem>
                  <SelectItem value="official_trip">ไปราชการ</SelectItem>
                  <SelectItem value="holiday">วันหยุด</SelectItem>
                  <SelectItem value="holiday_work">มาทำงาน (วันหยุด)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          {error && (
            <div className="p-4 m-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-sm">
              <span className="font-semibold">ข้อผิดพลาด:</span> {error.message}
            </div>
          )}
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[200px]">ชื่อ-สกุล</TableHead>
                <TableHead>กลุ่มงาน</TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>เวลาเข้า</TableHead>
                <TableHead>เวลาออก</TableHead>
                <TableHead>ระยะห่าง (เมตร)</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-rose-500">
                    ไม่สามารถโหลดข้อมูลได้ โปรดตรวจสอบเงื่อนไขการค้นหา
                  </TableCell>
                </TableRow>
              ) : !data?.items || data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                    ไม่พบข้อมูลการลงเวลาในช่วงเวลาที่เลือก
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((record) => (
                  <TableRow key={record.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <UserCircle2 className="h-5 w-5 text-slate-400" />
                        {record.user.name_th || record.user.username || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {record.user.department?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.date), "d MMM yy", { locale: th })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-white">
                        {WORK_TYPE_MAP[record.work_type] || record.work_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.check_in_time ? (
                        <span className="font-medium text-slate-700">
                          {format(new Date(record.check_in_time), "HH:mm")}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.check_out_time ? (
                        <span className="font-medium text-slate-700">
                          {format(new Date(record.check_out_time), "HH:mm")}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {record.check_in_distance != null ? (
                          <button 
                            onClick={() => handleShowLocation(record, "in")}
                            className="text-[10px] text-blue-600 hover:underline text-left font-medium"
                          >
                            เข้า: {Math.round(record.check_in_distance)} ม.
                          </button>
                        ) : <span className="text-[10px] text-slate-400">-</span>}
                        {record.check_out_distance != null ? (
                          <button 
                            onClick={() => handleShowLocation(record, "out")}
                            className="text-[10px] text-slate-600 hover:underline text-left font-medium"
                          >
                            ออก: {Math.round(record.check_out_distance)} ม.
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_MAP[record.status]?.color || "bg-slate-100 text-slate-800"} variant="secondary">
                        {STATUS_MAP[record.status]?.label || record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-sm text-slate-500">
              แสดงรายการที่ {((page - 1) * 50) + 1} - {Math.min(page * 50, data.totalItems)} จากทั้งหมด {data.totalItems} รายการ
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ก่อนหน้า
              </Button>
              <div className="text-sm font-medium px-4">
                หน้า {page} จาก {data.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              พิกัดการลงเวลา{previewType === "in" ? "เข้า" : "ออก"} - {selectedRecord?.user.name_th || selectedRecord?.user.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700">พิกัดขณะลงเวลา{previewType === "in" ? "เข้างาน" : "ออกงาน"}</p>
                <p className="text-slate-500 font-mono text-sm mt-1">
                  {previewType === "in" 
                    ? (selectedRecord?.check_in_lat ? `${Number(selectedRecord.check_in_lat).toFixed(6)}, ${Number(selectedRecord.check_in_lng).toFixed(6)}` : "-")
                    : (selectedRecord?.check_out_lat ? `${Number(selectedRecord.check_out_lat).toFixed(6)}, ${Number(selectedRecord.check_out_lng).toFixed(6)}` : "-")
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">ระยะห่างจากสำนักงาน</p>
                <p className={cn(
                  "text-2xl font-black mt-1",
                  previewType === "in" ? "text-blue-600" : "text-slate-700"
                )}>
                  {previewType === "in" 
                    ? (selectedRecord?.check_in_distance != null ? Math.round(selectedRecord.check_in_distance) : "-")
                    : (selectedRecord?.check_out_distance != null ? Math.round(selectedRecord.check_out_distance) : "-")
                  } ม.
                </p>
              </div>
            </div>
            
            <div className="h-[450px] w-full border rounded-xl overflow-hidden shadow-inner">
              {isPreviewOpen && selectedRecord && (
                <MapWithNoSSR 
                  initialLocation={{
                    lat: previewType === "in" 
                      ? (selectedRecord.check_in_lat || selectedRecord.office_lat)
                      : (selectedRecord.check_out_lat || selectedRecord.office_lat),
                    lng: previewType === "in"
                      ? (selectedRecord.check_in_lng || selectedRecord.office_lng)
                      : (selectedRecord.check_out_lng || selectedRecord.office_lng)
                  }}
                  readOnly={true}
                  distance={previewType === "in" ? selectedRecord.check_in_distance : selectedRecord.check_out_distance}
                  isInArea={
                    (previewType === "in" ? selectedRecord.check_in_distance : selectedRecord.check_out_distance) <= 100
                  }
                  officeLat={selectedRecord.office_lat}
                  officeLng={selectedRecord.office_lng}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
