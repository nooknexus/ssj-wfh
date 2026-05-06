"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, UserCheck, FileText, Video, Clock, CheckCircle2, AlertCircle, UserX } from "lucide-react";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export default function DashboardPage() {
  const { data: session } = trpc.auth.getSession.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery();
  const { data: recent, isLoading: recentLoading } = trpc.dashboard.getRecentActivities.useQuery();

  const statCards = [
    {
      title: "สถานะการลงเวลา (วันนี้)",
      value: stats?.attendance ? (stats.attendance.work_type === "office" ? "เข้าสำนักงาน" : stats.attendance.work_type === "wfh" ? "WFH" : stats.attendance.work_type === "official_trip" ? "ไปราชการ" : "Onsite") : "ยังไม่ได้ลงเวลา",
      detail: stats?.attendance?.check_in_time ? `เวลา ${format(new Date(stats.attendance.check_in_time), "HH:mm")} น.` : undefined,
      icon: UserCheck,
      color: stats?.attendance ? "text-blue-500" : "text-slate-400",
      bg: stats?.attendance ? "bg-blue-100" : "bg-slate-100",
    },
    {
      title: "วันลาพักผ่อนคงเหลือ",
      value: `${stats?.vacationDaysLeft ?? 0} วัน`,
      icon: CalendarDays,
      color: "text-amber-500",
      bg: "bg-amber-100",
    },
    {
      title: "การประชุม (วันนี้)",
      value: `${stats?.todayMeetings ?? 0} นัดหมาย`,
      icon: Video,
      color: "text-indigo-500",
      bg: "bg-indigo-100",
    },
    {
      title: "งานที่ต้องดำเนินการ",
      value: `${stats?.pendingTasks ?? 0} รายการ`,
      icon: FileText,
      color: (stats?.pendingTasks ?? 0) > 0 ? "text-emerald-500" : "text-slate-400",
      bg: (stats?.pendingTasks ?? 0) > 0 ? "bg-emerald-100" : "bg-slate-100",
    },
  ];

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

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              {stat.detail && (
                <p className="text-xs text-slate-500 mt-1">{stat.detail}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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

        {/* Module 3: Web Conference */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-500" />
              ตารางจอง Web Conference ล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoading ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : recent?.bookings.length ? (
                recent.bookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{booking.title}</div>
                      <div className="text-xs text-slate-500">
                        {format(new Date(booking.date), "d MMM yy", { locale: th })} | {booking.room.name}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {booking.status === "approved" ? "ยืนยันแล้ว" : "รออนุมัติ"}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">ไม่พบข้อมูลการจอง</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Module 4: Document Tracking */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              งานสารบรรณที่ได้รับมอบหมายล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoading ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : recent?.documents.length ? (
                recent.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{doc.subject}</div>
                      <div className="text-xs text-slate-500">เลขที่ {doc.doc_number || "-"}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      {doc.status === "new" ? (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          รอรับเรื่อง
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          {doc.status}
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">ไม่พบงานที่ได้รับมอบหมาย</p>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
