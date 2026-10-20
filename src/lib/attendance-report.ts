/**
 * แบบรายงานการลงเวลาปฏิบัติราชการของเจ้าหน้าที่ (รายเดือน)
 * ฟังก์ชันในไฟล์นี้ไม่แตะฐานข้อมูล เพื่อให้ทดสอบได้ด้วย unit test
 */
import { getLateThreshold, mergeApprovedPeriods, type DayPeriod } from "./attendance-exception";

export type ReportColumn = "vacation" | "sick" | "personal" | "officialTrip" | "late" | "noCheckIn";

export const REPORT_COLUMNS: ReportColumn[] = ["vacation", "sick", "personal", "officialTrip", "late", "noCheckIn"];

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

/** ชื่อประเภทลา → คอลัมน์ในฟอร์ม ประเภทอื่นไปอยู่ในหมายเหตุ */
export const classifyLeaveType = (name: string | null | undefined): "vacation" | "sick" | "personal" | "other" => {
  const text = (name ?? "").replace(/\s+/g, "");
  if (text.includes("พักผ่อน")) return "vacation";
  if (text.includes("ป่วย")) return "sick";
  if (text.includes("กิจ")) return "personal";
  return "other";
};

export type ReportAttendance = {
  date: Date;
  check_in_time: Date | null;
  check_out_time: Date | null;
  work_type: string;
};

export type ReportLeave = {
  start_date: Date;
  end_date: Date;
  total_days: number;
  leaveTypeName: string;
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
  noCheckOutDays: number[];
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

export const buildMonthlyReportRow = (input: MonthlyReportInput): MonthlyReportRow => {
  const workingDays = workingDaysOfMonth(input);
  const maps = Object.fromEntries(REPORT_COLUMNS.map((column) => [column, new Map<number, number>()])) as Record<ReportColumn, Map<number, number>>;
  const otherLeave = new Map<string, number[]>();
  const planLeaveDays: number[] = [];
  const noCheckOutDays: number[] = [];
  const covered = new Set<number>();

  for (const leave of input.leaves) {
    const column = classifyLeaveType(leave.leaveTypeName);
    for (const { day, value } of leaveDaysInMonth(leave, workingDays)) {
      covered.add(day);
      if (column === "other") otherLeave.set(leave.leaveTypeName, [...(otherLeave.get(leave.leaveTypeName) ?? []), day]);
      else addDays(maps[column], day, value);
    }
  }

  const workingDayNumbers = new Set(workingDays.map((date) => date.getDate()));
  const exceptionsByDay = new Map<number, ReportException[]>();
  for (const exception of input.exceptions) {
    if (!isInMonth(exception.date, input.year, input.month) || !workingDayNumbers.has(exception.date.getDate())) continue;
    const day = exception.date.getDate();
    exceptionsByDay.set(day, [...(exceptionsByDay.get(day) ?? []), exception]);
    if (exception.type === "official_trip") addDays(maps.officialTrip, day, exceptionValue(exception.period));
    else planLeaveDays.push(day);
  }

  const attendanceByDay = new Map(
    input.attendance.filter((record) => isInMonth(record.date, input.year, input.month)).map((record) => [record.date.getDate(), record]),
  );
  for (const date of workingDays) {
    const day = date.getDate();
    const record = attendanceByDay.get(day);
    const dayExceptions = exceptionsByDay.get(day) ?? [];
    const period = mergeApprovedPeriods(dayExceptions.map((item) => item.period));
    if (record?.check_in_time) {
      if (record.work_type === "official_trip") addDays(maps.officialTrip, day, 1);
      const threshold = getLateThreshold(date, input.workingTime, input.afternoonStart, period);
      if (record.work_type !== "onsite" && record.check_in_time > threshold) addDays(maps.late, day, 1);
      const checkedOut = record.check_out_time && record.check_out_time.getTime() !== record.check_in_time.getTime();
      if (!checkedOut && isBeforeDay(date, input.today)) noCheckOutDays.push(day);
      continue;
    }
    if (covered.has(day) || period === "full" || !isBeforeDay(date, input.today)) continue;
    // ไม่มีการลงเวลา: ถ้าแจ้งครึ่งวันไว้ นับขาดครึ่งวัน
    addDays(maps.noCheckIn, day, period ? 0.5 : 1);
  }

  const remarks = [
    ...[...otherLeave.entries()].map(([name, days]) => `${name} ${formatDayList(days)}`),
    ...(planLeaveDays.length ? [`แจ้งลา(แผนงาน) ${formatDayList(planLeaveDays)}`] : []),
  ];

  return {
    columns: Object.fromEntries(REPORT_COLUMNS.map((column) => [column, toCell(maps[column])])) as Record<ReportColumn, ReportCell>,
    noCheckOutDays: noCheckOutDays.sort((a, b) => a - b),
    remark: remarks.join(" / "),
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
