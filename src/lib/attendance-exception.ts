/**
 * ข้อยกเว้นการลงเวลา (แจ้งลา / ไปราชการ) จากหน้าแผนงานรายสัปดาห์
 * ไม่เกี่ยวข้องกับใบลาจริง (leave_requests) ที่ Sync จาก Google Sheet
 */

export type ExceptionType = "leave" | "official_trip";
export type DayPeriod = "full" | "morning" | "afternoon";
export type ExceptionStatus = "pending" | "approved" | "rejected" | "cancelled";

export const EXCEPTION_TYPES: ExceptionType[] = ["leave", "official_trip"];
export const DAY_PERIODS: DayPeriod[] = ["full", "morning", "afternoon"];
export const ACTIVE_EXCEPTION_STATUSES: ExceptionStatus[] = ["pending", "approved"];

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  leave: "ลา",
  official_trip: "ไปราชการ",
};

export const DAY_PERIOD_LABELS: Record<DayPeriod, string> = {
  full: "เต็มวัน",
  morning: "ครึ่งเช้า",
  afternoon: "ครึ่งบ่าย",
};

export const EXCEPTION_STATUS_LABELS: Record<ExceptionStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
};

export const DEFAULT_AFTERNOON_START = "13:00";

/** ช่วงเวลาซ้อนกันหรือไม่: เต็มวันชนทุกแบบ ครึ่งเช้ากับครึ่งบ่ายอยู่วันเดียวกันได้ */
export const periodsConflict = (a: DayPeriod, b: DayPeriod): boolean =>
  a === "full" || b === "full" || a === b;

const toDayNumber = (date: Date): number =>
  date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

/** ตรวจวันที่ยื่นได้: ต้องเป็นวันจันทร์–ศุกร์ และไม่ใช่วันที่ผ่านไปแล้ว (วันนี้ยื่นได้) */
export const validateExceptionDate = (date: Date, today: Date): string | null => {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) {
    return "แจ้งลาหรือไปราชการได้เฉพาะวันจันทร์ถึงวันศุกร์";
  }
  if (toDayNumber(date) < toDayNumber(today)) {
    return "ไม่สามารถแจ้งย้อนหลังได้";
  }
  return null;
};

/** ทำให้วันที่เป็นเวลาเที่ยงวัน เพื่อเลี่ยงปัญหา timezone ขอบวัน (Noon Normalization) */
export const normalizeToNoon = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
};

const atTime = (date: Date, time: string): Date => {
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hour || 0, minute || 0, 0, 0);
  return result;
};

/** เวลาที่เริ่มนับว่าสาย: ถ้าได้รับอนุมัติครึ่งเช้า ให้เลื่อนไปเป็นเวลาเริ่มงานช่วงบ่าย */
export const getLateThreshold = (
  date: Date,
  workingTime: string,
  afternoonStart: string,
  approvedPeriod?: DayPeriod | null,
): Date => atTime(date, approvedPeriod === "morning" ? afternoonStart : workingTime);

/** ได้รับอนุมัติเต็มวันแล้วไม่ต้อง (และไม่ให้) ลงเวลา */
export const blocksCheckIn = (approvedPeriod?: DayPeriod | null): boolean => approvedPeriod === "full";

/** ไม่ต้องเตือนลงเวลาออกงาน ถ้าได้รับอนุมัติเต็มวันหรือครึ่งบ่าย */
export const skipsCheckoutReminder = (approvedPeriod?: DayPeriod | null): boolean =>
  approvedPeriod === "full" || approvedPeriod === "afternoon";

type ExceptionSummary = {
  type: ExceptionType;
  period: DayPeriod;
  reason?: string | null;
  location?: string | null;
};

export const describeException = (exception: ExceptionSummary): string => {
  const label = `แจ้ง${EXCEPTION_TYPE_LABELS[exception.type]}${DAY_PERIOD_LABELS[exception.period]} (แผนงาน)`;
  const details = [exception.location, exception.reason].filter(Boolean).join(" - ");
  return details ? `${label}: ${details}` : label;
};

/**
 * สถานะในรายงานสำหรับวันที่ไม่ได้ลงเวลาแต่มีข้อยกเว้นที่อนุมัติแล้ว
 * เต็มวัน: ลา / ไปราชการ  ครึ่งวัน: ขาด (เพราะไม่ได้ลงเวลาช่วงที่เหลือ) พร้อมหมายเหตุ
 */
export const resolveExceptionStatus = (
  exception: ExceptionSummary,
): { status: "leave" | "official_trip" | "absent"; tasks: string } => {
  const note = describeException(exception);
  if (exception.period !== "full") {
    const otherHalf = exception.period === "morning" ? "ช่วงบ่าย" : "ช่วงเช้า";
    return { status: "absent", tasks: `${note} / ไม่ได้ลงเวลา${otherHalf}` };
  }
  return { status: exception.type, tasks: note };
};
