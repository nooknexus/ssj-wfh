/**
 * แบบรายงานการลงเวลาปฏิบัติราชการของเจ้าหน้าที่ (รายเดือน)
 * ฟังก์ชันในไฟล์นี้ไม่แตะฐานข้อมูล เพื่อให้ทดสอบได้ด้วย unit test
 */
import { getLateThreshold, mergeApprovedPeriods, type DayPeriod } from "./attendance-exception";

export type ReportColumn = "vacation" | "sick" | "personal" | "officialTrip" | "late" | "noCheckIn" | "noCheckOut";

export const REPORT_COLUMNS: ReportColumn[] = ["vacation", "sick", "personal", "officialTrip", "late", "noCheckIn", "noCheckOut"];

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "2026-10" → { year: 2026, month: 10 } หรือ null ถ้ารูปแบบไม่ถูกต้อง */
export const parseReportMonth = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
};

export const formatThaiMonth = (year: number, month: number): string => `${THAI_MONTHS[month - 1]} พ.ศ. ${year + 543}`;

/** เลขวันที่เรียงและไม่ซ้ำ ย่อวันที่ต่อกันตั้งแต่ 3 วันขึ้นไปเป็นช่วง เช่น "3, 4, 15–17" */
export const formatDayList = (days: readonly number[]): string => {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.join(", ");
};

export type ReportAttendance = {
  date: Date;
  check_in_time: Date | null;
  check_out_time: Date | null;
  work_type: string;
  /** หมายเหตุที่ผู้ใช้กรอกเองในประวัติการลงเวลา */
  remark?: string | null;
};

export type ReportLeave = {
  start_date: Date;
  end_date: Date;
  total_days: number;
};

export type ReportException = {
  date: Date;
  type: "leave" | "official_trip";
  period: DayPeriod;
};

export type MonthlyReportInput = {
  year: number;
  month: number;
  today: Date;
  isHolidayDate: (date: Date) => boolean;
  workingTime: string;
  afternoonStart: string;
  attendance: ReportAttendance[];
  leaves: ReportLeave[];
  exceptions: ReportException[];
};

export type ReportCell = { days: number[]; total: number };

export type MonthlyReportRow = {
  columns: Record<ReportColumn, ReportCell>;
  remark: string;
};

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
const isBeforeDay = (date: Date, today: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

/** วันทำการทั้งหมดของเดือน (ไม่รวมเสาร์-อาทิตย์และวันหยุดนักขัตฤกษ์) */
const workingDaysOfMonth = (input: MonthlyReportInput): Date[] => {
  const last = new Date(input.year, input.month, 0).getDate();
  return Array.from({ length: last }, (_, index) => new Date(input.year, input.month - 1, index + 1, 12))
    .filter((date) => !isWeekend(date) && !input.isHolidayDate(date));
};

const addDays = (map: Map<number, number>, day: number, value: number) => map.set(day, Math.max(map.get(day) ?? 0, value));

const toCell = (map: Map<number, number>): ReportCell => ({
  days: [...map.keys()].sort((a, b) => a - b),
  total: [...map.values()].reduce((sum, value) => sum + value, 0),
});

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const isInMonth = (date: Date, year: number, month: number) => date.getFullYear() === year && date.getMonth() === month - 1;

/** วันลาที่เป็นวันทำการในเดือนนี้ ใบลาวันเดียวที่น้อยกว่า 1 วัน (เช่น 0.5) นับตามจำนวนนั้น */
const leaveDaysInMonth = (leave: ReportLeave, workingDays: Date[]) => {
  const start = startOfLocalDay(leave.start_date);
  const end = startOfLocalDay(leave.end_date);
  const inRange = workingDays.filter((date) => startOfLocalDay(date) >= start && startOfLocalDay(date) <= end);
  const isSingleDay = start.getTime() === end.getTime();
  const perDay = isSingleDay && leave.total_days > 0 && leave.total_days < 1 ? leave.total_days : 1;
  return inRange.map((date) => ({ day: date.getDate(), value: perDay }));
};

const exceptionValue = (period: DayPeriod) => (period === "full" ? 1 : 0.5);

const PLAN_LEAVE_PART: Record<DayPeriod, LeavePart> = { full: "full", morning: "ครึ่งเช้า", afternoon: "ครึ่งบ่าย" };

type LeavePart = "full" | "ครึ่งเช้า" | "ครึ่งบ่าย" | "ครึ่งวัน";

/** รวมส่วนของวันลา: เต็มวันชนะทุกแบบ และครึ่งเช้า + ครึ่งบ่ายวันเดียวกันเป็นเต็มวัน */
const mergeLeavePart = (current: LeavePart | undefined, next: LeavePart): LeavePart => {
  if (!current || current === next) return next;
  if (current === "full" || next === "full") return "full";
  const halves = new Set([current, next]);
  return halves.has("ครึ่งเช้า") && halves.has("ครึ่งบ่าย") ? "full" : current;
};

/** วันลาในหมายเหตุ เช่น "5–7, 9 (ครึ่งเช้า), 12 (ครึ่งวัน)" วันเต็มที่ติดกันย่อเป็นช่วง */
const formatLeaveDays = (parts: Map<number, LeavePart>): string => {
  const tokens: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length) tokens.push(formatDayList(run));
    run = [];
  };
  for (const day of [...parts.keys()].sort((a, b) => a - b)) {
    const part = parts.get(day)!;
    if (part === "full") {
      run.push(day);
      continue;
    }
    flush();
    tokens.push(`${day} (${part})`);
  }
  flush();
  return tokens.join(", ");
};

/** หมายเหตุของผู้ใช้แบบ "วันที่: ข้อความ" ข้อความเดียวกันหลายวันรวมเป็นบรรทัดเดียว เรียงตามวันแรก */
const formatUserRemarks = (input: MonthlyReportInput): string[] => {
  const daysByText = new Map<string, number[]>();
  for (const record of input.attendance) {
    const text = record.remark?.trim().replace(/\s+/g, " ");
    if (!text || !isInMonth(record.date, input.year, input.month)) continue;
    daysByText.set(text, [...(daysByText.get(text) ?? []), record.date.getDate()]);
  }
  return [...daysByText.entries()]
    .sort(([, a], [, b]) => Math.min(...a) - Math.min(...b))
    .map(([text, days]) => `${formatDayList(days)}: ${text}`);
};

export const buildMonthlyReportRow = (input: MonthlyReportInput): MonthlyReportRow => {
  const workingDays = workingDaysOfMonth(input);
  const maps = Object.fromEntries(REPORT_COLUMNS.map((column) => [column, new Map<number, number>()])) as Record<ReportColumn, Map<number, number>>;
  // วันที่ลา (ใบลาจากระบบลาและแจ้งลาในแผนงาน) ช่องลาแต่ละประเภทให้เจ้าหน้าที่เขียนเองหลังพิมพ์
  const leaveParts = new Map<number, LeavePart>();
  /** วันที่มีใบลาจากระบบลา: ครึ่งวันไม่รู้ว่าเช้าหรือบ่าย */
  const sourceLeave = new Map<number, "full" | "half">();

  for (const leave of input.leaves) {
    for (const { day, value } of leaveDaysInMonth(leave, workingDays)) {
      const half = value < 1;
      sourceLeave.set(day, sourceLeave.get(day) === "full" || !half ? "full" : "half");
      leaveParts.set(day, mergeLeavePart(leaveParts.get(day), half ? "ครึ่งวัน" : "full"));
    }
  }

  const workingDayNumbers = new Set(workingDays.map((date) => date.getDate()));
  const exceptionsByDay = new Map<number, ReportException[]>();
  for (const exception of input.exceptions) {
    if (!isInMonth(exception.date, input.year, input.month) || !workingDayNumbers.has(exception.date.getDate())) continue;
    const day = exception.date.getDate();
    exceptionsByDay.set(day, [...(exceptionsByDay.get(day) ?? []), exception]);
    if (exception.type === "official_trip") addDays(maps.officialTrip, day, exceptionValue(exception.period));
    else leaveParts.set(day, mergeLeavePart(leaveParts.get(day), PLAN_LEAVE_PART[exception.period]));
  }

  const attendanceByDay = new Map(
    input.attendance.filter((record) => isInMonth(record.date, input.year, input.month)).map((record) => [record.date.getDate(), record]),
  );
  for (const date of workingDays) {
    const day = date.getDate();
    const record = attendanceByDay.get(day);
    const dayExceptions = exceptionsByDay.get(day) ?? [];
    const period = mergeApprovedPeriods(dayExceptions.map((item) => item.period));
    const leave = sourceLeave.get(day);
    if (record?.check_in_time) {
      if (record.work_type === "official_trip") addDays(maps.officialTrip, day, 1);
      // ใบลาครึ่งวันจากระบบลาไม่รู้ว่าเช้าหรือบ่าย จึงให้ใช้เวลาตัดสายช่วงบ่าย
      const latePeriod = period ?? (leave === "half" ? "morning" : null);
      const threshold = getLateThreshold(date, input.workingTime, input.afternoonStart, latePeriod);
      const exemptFromLate = record.work_type === "onsite" || record.work_type === "official_trip" || period === "full" || leave === "full";
      if (!exemptFromLate && record.check_in_time > threshold) addDays(maps.late, day, 1);
      // ลา/ไปราชการครึ่งบ่ายหรือเต็มวัน หรือมีใบลาจากระบบลา ไม่ต้องสแกนออก
      const exemptFromCheckOut = period === "afternoon" || period === "full" || Boolean(leave);
      const checkedOut = record.check_out_time && record.check_out_time.getTime() !== record.check_in_time.getTime();
      if (!checkedOut && !exemptFromCheckOut && isBeforeDay(date, input.today)) addDays(maps.noCheckOut, day, 1);
      continue;
    }
    if (leave || period === "full" || !isBeforeDay(date, input.today)) continue;
    // ไม่มีการลงเวลา: ถ้าแจ้งลา/ไปราชการครึ่งวันในแผนงาน นับขาดครึ่งวัน (ใบลาจากระบบลาไม่นับ)
    addDays(maps.noCheckIn, day, period ? 0.5 : 1);
  }

  return {
    columns: Object.fromEntries(REPORT_COLUMNS.map((column) => [column, toCell(maps[column])])) as Record<ReportColumn, ReportCell>,
    remark: [leaveParts.size ? `ลา ${formatLeaveDays(leaveParts)}` : "", ...formatUserRemarks(input)]
      .filter(Boolean)
      .join("\n"),
  };
};

/** แถวประเภทบุคลากรตามฟอร์ม */
export const PERSONNEL_TYPE_ROWS = ["ข้าราชการ", "ลูกจ้างประจำ", "พนักงานราชการ", "ลูกจ้างชั่วคราว", "มาช่วยราชการ"];

/** นับจำนวนตามประเภท: แถวตามฟอร์มก่อน ตามด้วยประเภทที่ไม่มีในฟอร์ม และผู้ที่ไม่พบข้อมูล */
export const countPersonnelTypes = (types: ReadonlyArray<string | null | undefined>): {
  rows: Array<{ label: string; count: number }>;
  total: number;
} => {
  const counts = new Map<string, number>();
  for (const type of types) {
    const label = type?.trim() || "ไม่พบข้อมูลประเภทบุคลากร";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const extras = [...counts.keys()].filter((label) => !PERSONNEL_TYPE_ROWS.includes(label)).sort((a, b) => {
    if (a === "ไม่พบข้อมูลประเภทบุคลากร") return 1;
    if (b === "ไม่พบข้อมูลประเภทบุคลากร") return -1;
    return a.localeCompare(b, "th");
  });
  return {
    rows: [...PERSONNEL_TYPE_ROWS, ...extras].map((label) => ({ label, count: counts.get(label) ?? 0 })),
    total: types.length,
  };
};
