"use client";

import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { AlertCircle, CalendarDays, ChevronRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import type { TodayOverview } from "@/lib/attendance-overview";

type Scope = "team" | "self";

const TILES: {
  key: keyof Omit<TodayOverview, "total">;
  label: Record<Scope, string>;
  tone: { tile: string; dot: string; value: string };
  hint?: Record<Scope, string>;
}[] = [
  {
    key: "notCheckedIn",
    label: { team: "ยังไม่ลงเวลา", self: "ไม่ได้ลงเวลา" },
    tone: { tile: "bg-slate-50 border-slate-200", dot: "bg-slate-400", value: "text-slate-800" },
    hint: {
      team: "ยังไม่ได้ลงเวลาเข้างานวันนี้ และไม่ได้ลา",
      self: "วันทำการที่ผ่านมาแล้วที่ไม่มีการลงเวลาและไม่ได้ลา (ไม่นับวันนี้)",
    },
  },
  {
    key: "onTime",
    label: { team: "ทันเวลา", self: "ทันเวลา" },
    tone: { tile: "bg-emerald-50 border-emerald-100", dot: "bg-emerald-500", value: "text-emerald-700" },
  },
  {
    key: "late",
    label: { team: "มาสาย", self: "มาสาย" },
    tone: { tile: "bg-amber-50 border-amber-100", dot: "bg-amber-500", value: "text-amber-700" },
  },
  {
    key: "outsideArea",
    label: { team: "นอกบริเวณ", self: "นอกบริเวณ" },
    tone: { tile: "bg-violet-50 border-violet-100", dot: "bg-violet-500", value: "text-violet-700" },
    hint: {
      team: "ลงเวลาแบบเข้าสำนักงานแต่อยู่นอกรัศมีสำนักงาน (นับรวมอยู่ในทันเวลา/มาสายด้วย)",
      self: "วันที่ลงเวลาแบบเข้าสำนักงานแต่อยู่นอกรัศมีสำนักงาน (นับรวมอยู่ในทันเวลา/มาสายด้วย)",
    },
  },
  {
    key: "onLeave",
    label: { team: "ลางาน", self: "ลางาน" },
    tone: { tile: "bg-sky-50 border-sky-100", dot: "bg-sky-500", value: "text-sky-700" },
    hint: {
      team: "ใบลาที่อนุมัติแล้ว หรือแจ้งลาเต็มวันในแผนงาน",
      self: "วันที่มีใบลาที่อนุมัติแล้ว หรือแจ้งลาเต็มวันในแผนงาน",
    },
  },
  {
    key: "officialTrip",
    label: { team: "ไปราชการ", self: "ไปราชการ" },
    tone: { tile: "bg-teal-50 border-teal-100", dot: "bg-teal-500", value: "text-teal-700" },
    hint: {
      team: "แจ้งไปราชการเต็มวันในแผนงานที่อนุมัติแล้ว",
      self: "วันที่แจ้งไปราชการเต็มวันในแผนงานที่อนุมัติแล้ว",
    },
  },
];

/**
 * การลงเวลาปฏิบัติงาน
 * team: ภาพรวมวันนี้ของหัวหน้างาน (กลุ่มงานตัวเอง) และ HR (ทั้งหน่วยงาน) นับเป็นคน
 * self: ของพนักงานเอง ตั้งแต่ต้นเดือนถึงวันนี้ นับเป็นวัน
 */
export function AttendanceSummaryCard({ scope }: { scope: Scope }) {
  const queryOptions = {
    refetchInterval: 60_000,
    // ไม่มีสิทธิ์/ยังไม่ได้กำหนดกลุ่มงาน ลองซ้ำก็ไม่หาย แสดงข้อความทันที
    retry: (failureCount: number, err: { data?: { code?: string } | null }) =>
      err.data?.code !== "FORBIDDEN" && failureCount < 3,
  };
  const team = trpc.attendance.getTodayOverview.useQuery(undefined, { ...queryOptions, enabled: scope === "team" });
  const self = trpc.attendance.getMyMonthOverview.useQuery(undefined, { ...queryOptions, enabled: scope === "self" });
  const { data, isLoading, error } = scope === "team" ? team : self;
  const errorMessage = error
    ? error.data?.code === "FORBIDDEN"
      ? error.message
      : "ไม่สามารถโหลดข้อมูลการลงเวลาได้ กรุณาลองใหม่อีกครั้ง"
    : null;
  const now = new Date();

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-slate-900">การลงเวลาปฏิบัติงาน</CardTitle>
          {scope === "team" ? (
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              วันนี้ {format(now, "d MMM yyyy", { locale: th })}
              {data && <span className="w-full pl-5 sm:w-auto sm:pl-0"><span className="hidden sm:inline">· </span>ทั้งหมด {data.total} คน</span>}
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
              <CalendarDays className="w-3.5 h-3.5" />
              ของฉัน เดือน{format(now, "MMMM yyyy", { locale: th })}
              {data && <span className="w-full pl-5 sm:w-auto sm:pl-0"><span className="hidden sm:inline">· </span>วันทำการถึงวันนี้ {data.total} วัน</span>}
            </p>
          )}
        </div>
        {!errorMessage && (
          <Link
            href={scope === "team" ? "/admin/attendance" : "/attendance"}
            className="flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            ดูรายละเอียด
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm leading-relaxed">{errorMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 xl:grid-cols-6">
            {TILES.map((tile) => (
              <div
                key={tile.key}
                title={tile.hint?.[scope]}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 sm:items-start sm:gap-2 sm:px-4 sm:py-4",
                  tile.tone.tile,
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tile.tone.dot)} />
                  <span className="hidden text-sm font-medium text-slate-600 sm:inline">{tile.label[scope]}</span>
                </span>
                <span className={cn("text-2xl font-bold tabular-nums sm:text-3xl", tile.tone.value)}>
                  {isLoading ? (
                    <span className="inline-block h-7 w-8 animate-pulse rounded bg-white/70 align-middle" />
                  ) : (
                    <>
                      {data?.[tile.key] ?? 0}
                      <span className="ml-1 hidden text-sm font-medium text-slate-500 sm:inline">
                        {scope === "team" ? "คน" : "วัน"}
                      </span>
                    </>
                  )}
                </span>
                <span className="whitespace-nowrap text-center text-[10px] leading-tight text-slate-500 sm:hidden">
                  {tile.label[scope]}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
