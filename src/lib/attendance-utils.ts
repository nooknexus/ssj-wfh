import { DEFAULT_AFTERNOON_START, type DayPeriod } from "./attendance-exception";

export const isManualLocationAllowed = (settingValue?: string | null): boolean => {
  if (settingValue === undefined || settingValue === null) {
    return true;
  }
  return settingValue.toLowerCase() !== "false";
};

/** บังคับกรอกสรุปงานที่ทำในวันนี้ก่อนลงเวลาออก: ปิดเฉพาะเมื่อตั้งค่าเป็น "false" (ไม่มีค่า = บังคับ) */
export const isCheckoutTasksRequired = (settingValue?: string | null): boolean =>
  (settingValue ?? "").toLowerCase() !== "false";

export const DEFAULT_WORKING_TIME = "08:30";
export const WORK_DAY_HOURS = 8;
/** วันที่ลา/ไปราชการครึ่งวัน (ช่วงเช้า 08:30–12:00 หรือช่วงบ่าย 13:00–16:30) */
export const HALF_DAY_WORK_HOURS = 3.5;

const MINUTE_MS = 60 * 1000;

const atTime = (date: Date, time: string): Date => {
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hour || 0, minute || 0, 0, 0);
  return result;
};

/**
 * ความคืบหน้าการทำงานวันนี้: เริ่มนับจากเวลาเข้างาน (ถ้าเข้าก่อนเวลาเริ่มงาน นับจากเวลาเริ่มงาน)
 * เวลาออกงาน = เวลาเริ่มนับ + ชั่วโมงที่ต้องทำ เพื่อให้ครบชั่วโมงแม้เข้างานสาย
 * ถ้าแผนงานอนุมัติลา/ไปราชการครึ่งเช้า นับเฉพาะช่วงบ่าย ครึ่งบ่ายนับเฉพาะช่วงเช้า (ช่วงละ 3.5 ชม.)
 */
export const getWorkProgress = (
  checkIn: Date,
  now: Date,
  {
    workingTime = DEFAULT_WORKING_TIME,
    afternoonStart = DEFAULT_AFTERNOON_START,
    exceptionPeriod,
  }: { workingTime?: string; afternoonStart?: string; exceptionPeriod?: DayPeriod | null } = {},
): { workedMinutes: number; percent: number; endTime: Date; requiredHours: number } => {
  const isHalfDay = exceptionPeriod === "morning" || exceptionPeriod === "afternoon";
  const requiredHours = isHalfDay ? HALF_DAY_WORK_HOURS : WORK_DAY_HOURS;
  const dayStart = atTime(checkIn, exceptionPeriod === "morning" ? afternoonStart : workingTime);
  const start = Math.max(checkIn.getTime(), dayStart.getTime());
  const span = requiredHours * 60 * MINUTE_MS;
  const elapsed = Math.max(0, now.getTime() - start);

  return {
    workedMinutes: Math.floor(elapsed / MINUTE_MS),
    percent: Math.min(100, (elapsed / span) * 100),
    endTime: new Date(start + span),
    requiredHours,
  };
};

export const formatWorkedDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} ชม. ${rest} นาที` : `${rest} นาที`;
};
