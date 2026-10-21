"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, UserCheck, Clock } from "lucide-react";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AttendanceSummaryCard } from "@/components/attendance/attendance-summary-card";
import { ATTENDANCE_REPORT_ROLES, hasAnyRole } from "@/lib/roles";

export default function DashboardPage() {
  const { data: session } = trpc.auth.getSession.useQuery();
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: recent, isLoading: recentLoading } = trpc.dashboard.getRecentActivities.useQuery();
  const todayAttendance = stats?.attendance;

  const getWorkTypeLabel = (type: string) => {
    switch (type) {
      case "office": return "เข้าสำนักงาน";
      case "wfh": return "WFH";
      case "official_trip": return "ไปราชการ";
      case "onsite": return "Onsite";
      default: return type;
    }
  };

  const getWorkTypeBg = (type: string) => {
    switch (type) {
      case "office": return "bg-green-100 text-green-700";
      case "wfh": return "bg-amber-100 text-amber-700";
      case "official_trip": return "bg-blue-100 text-blue-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getLeaveStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700";
      case "approved": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const getLeaveStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "รออนุมัติ";
      case "approved": return "อนุมัติแล้ว";
      case "rejected": return "ไม่อนุมัติ";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ยินดีต้อนรับ, {session?.user?.name || "ผู้ใช้งาน"}
        </h1>
      </div>

      {session?.user && (
        <AttendanceSummaryCard scope={hasAnyRole(session.user.roles, ATTENDANCE_REPORT_ROLES) ? "team" : "self"} />
      )}

      {/* สถานะการลงเวลาของตัวเองวันนี้ */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("p-3 rounded-2xl", todayAttendance ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400")}>
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">สถานะการลงเวลา (วันนี้)</p>
              <p className="text-xl font-bold text-slate-900">
                {todayAttendance ? getWorkTypeLabel(todayAttendance.work_type) : "ยังไม่ได้ลงเวลา"}
              </p>
              {todayAttendance?.check_in_time && (
                <p className="text-xs text-slate-500 mt-0.5">
                  เข้างาน {format(new Date(todayAttendance.check_in_time), "HH:mm")} น.
                  {todayAttendance.check_out_time && ` · ออกงาน ${format(new Date(todayAttendance.check_out_time), "HH:mm")} น.`}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/attendance"
            className={cn(
              buttonVariants({ variant: todayAttendance?.check_out_time ? "outline" : "default" }),
              "rounded-xl sm:w-auto w-full",
              !todayAttendance?.check_out_time && "bg-blue-600 hover:bg-blue-700",
            )}
          >
            {!todayAttendance ? "ลงเวลาเข้างาน" : !todayAttendance.check_out_time ? "ลงเวลาออกงาน" : "ดูการลงเวลา"}
          </Link>
        </CardContent>
      </Card>

      {/* Module Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Module 1: Attendance & WFH */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              ประวัติการลงเวลาล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoading ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : recent?.attendance.length ? (
                recent.attendance.map((record) => (
                  <div key={record.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="text-sm font-medium text-slate-900">
                      {format(new Date(record.date), "d MMM yy", { locale: th })}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${getWorkTypeBg(record.work_type)}`}>
                      {getWorkTypeLabel(record.work_type)}
                      {record.check_in_time && ` (${format(new Date(record.check_in_time), "HH:mm")})`}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">ไม่พบประวัติการลงเวลา</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Module 2: Leave Management */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-500" />
              ประวัติการขออนุญาตลาล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoading ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : recent?.leaves.length ? (
                recent.leaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {leave.leave_type.name} ({format(new Date(leave.start_date), "d MMM", { locale: th })} - {format(new Date(leave.end_date), "d MMM", { locale: th })})
                      </div>
                      <div className="text-xs text-slate-500">ยื่นคำขอเมื่อ {format(new Date(leave.created_at), "d MMM yy", { locale: th })}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${getLeaveStatusBadge(leave.status)}`}>
                      {getLeaveStatusLabel(leave.status)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">ไม่พบประวัติการลา</p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
