import type { DayPeriod, ExceptionStatus, ExceptionType } from "./attendance-exception";

export type RequestKind = ExceptionType | "wfh";

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  official_trip: "แจ้งไปราชการ",
  leave: "แจ้งลา",
  wfh: "ขออนุมัติ WFH",
};

/** คำขอของผู้ใช้หนึ่งรายการ (แจ้งลา/ไปราชการจากแผนงาน หรือคำขอ WFH) สำหรับการ์ดใน Dashboard */
export type RecentRequest = {
  key: string;
  kind: RequestKind;
  startDate: Date;
  endDate: Date;
  /** ช่วงของวันสำหรับแจ้งลา/ไปราชการ (WFH ไม่มี) */
  period: DayPeriod | null;
  status: ExceptionStatus;
  createdAt: Date;
};

type ExceptionRow = { id: number; type: ExceptionType; date: Date; period: DayPeriod; status: ExceptionStatus; created_at: Date };
type WfhRow = { id: number; start_date: Date; end_date: Date; status: "pending" | "approved" | "rejected"; created_at: Date };

/** รวมคำขอทั้งสองแบบ เรียงตามเวลาที่ยื่นล่าสุดก่อน */
export const mergeRecentRequests = (
  exceptions: readonly ExceptionRow[],
  wfh: readonly WfhRow[],
  limit: number,
): RecentRequest[] =>
  [
    ...exceptions.map((item) => ({
      key: `exception-${item.id}`,
      kind: item.type,
      startDate: item.date,
      endDate: item.date,
      period: item.period,
      status: item.status,
      createdAt: item.created_at,
    })),
    ...wfh.map((item) => ({
      key: `wfh-${item.id}`,
      kind: "wfh" as const,
      startDate: item.start_date,
      endDate: item.end_date,
      period: null,
      status: item.status,
      createdAt: item.created_at,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
