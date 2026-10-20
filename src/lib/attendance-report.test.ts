import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportRow,
  classifyLeaveType,
  countPersonnelTypes,
  formatDayList,
  formatThaiMonth,
  parseReportMonth,
  type MonthlyReportInput,
} from "./attendance-report";

// ตุลาคม 2026: วันที่ 1 เป็นวันพฤหัสบดี มีวันทำการ 22 วัน (ก่อนหักวันหยุด)
const local = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute);
const dbDate = (month: number, day: number) => new Date(Date.UTC(2026, month - 1, day)); // คอลัมน์ DATE จาก Prisma

const base = (overrides: Partial<MonthlyReportInput> = {}): MonthlyReportInput => ({
  year: 2026,
  month: 10,
  today: local(31),
  isHolidayDate: () => false,
  workingTime: "08:30",
  afternoonStart: "13:00",
  attendance: [],
  leaves: [],
  exceptions: [],
  ...overrides,
});

describe("formatDayList", () => {
  it("should handle empty, single and pairs", () => {
    expect(formatDayList([])).toBe("");
    expect(formatDayList([5])).toBe("5");
    expect(formatDayList([4, 3])).toBe("3, 4");
  });

  it("should collapse three or more consecutive days and drop duplicates", () => {
    expect(formatDayList([17, 3, 15, 16, 16])).toBe("3, 15–17");
    expect(formatDayList([1, 2, 3, 5, 6])).toBe("1–3, 5, 6");
  });
});

describe("month helpers", () => {
  it("should parse YYYY-MM and format Thai month with BE year", () => {
    expect(parseReportMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseReportMonth("2026-13")).toBeNull();
    expect(parseReportMonth("10/2026")).toBeNull();
    expect(formatThaiMonth(2026, 10)).toBe("ตุลาคม พ.ศ. 2569");
  });
});

describe("classifyLeaveType", () => {
  it("should map leave names to form columns", () => {
    expect(classifyLeaveType("ลาพักผ่อน")).toBe("vacation");
    expect(classifyLeaveType("ลาป่วย")).toBe("sick");
    expect(classifyLeaveType("ลากิจ")).toBe("personal");
    expect(classifyLeaveType("ลาคลอดบุตร")).toBe("personal");
    expect(classifyLeaveType("ลาอุปสมบท")).toBe("personal");
  });
});

describe("buildMonthlyReportRow", () => {
  it("should count every past working day without check-in as no check-in", () => {
    const row = buildMonthlyReportRow(base());
    expect(row.columns.noCheckIn.total).toBe(22);
    expect(row.columns.noCheckIn.days).toContain(30);
    expect(row.columns.noCheckIn.days).not.toContain(3); // วันเสาร์
  });

  it("should skip holidays and future days", () => {
    const row = buildMonthlyReportRow(base({ today: local(15), isHolidayDate: (date) => date.getDate() === 13 }));
    expect(row.columns.noCheckIn.days).toEqual([1, 2, 5, 6, 7, 8, 9, 12, 14]);
  });

  it("should detect late arrival and missing check-out", () => {
    const row = buildMonthlyReportRow(base({
      attendance: [
        { date: dbDate(10, 1), check_in_time: local(1, 8, 45), check_out_time: local(1, 16, 30), work_type: "office" },
        { date: dbDate(10, 2), check_in_time: local(2, 8, 0), check_out_time: null, work_type: "office" },
        { date: dbDate(10, 5), check_in_time: local(5, 9, 30), check_out_time: local(5, 16, 30), work_type: "onsite" },
      ],
    }));
    expect(row.columns.late).toEqual({ days: [1], total: 1 });
    expect(row.noCheckOutDays).toEqual([2]);
    expect(row.columns.noCheckIn.days).not.toContain(1);
  });

  it("should count leaves by type, including half days, other types and leaves crossing months", () => {
    const row = buildMonthlyReportRow(base({
      leaves: [
        { start_date: dbDate(9, 29), end_date: dbDate(10, 2), total_days: 4, leaveTypeName: "ลาพักผ่อน" },
        { start_date: dbDate(10, 5), end_date: dbDate(10, 6), total_days: 2, leaveTypeName: "ลาป่วย" },
        { start_date: dbDate(10, 7), end_date: dbDate(10, 7), total_days: 0.5, leaveTypeName: "ลากิจ" },
        { start_date: dbDate(10, 12), end_date: dbDate(10, 12), total_days: 1, leaveTypeName: "ลาคลอดบุตร" },
      ],
    }));
    expect(row.columns.vacation).toEqual({ days: [1, 2], total: 2 });
    expect(row.columns.sick).toEqual({ days: [5, 6], total: 2 });
    expect(row.columns.personal).toEqual({ days: [7, 12], total: 1.5 }); // ลากิจครึ่งวัน + ลาคลอดบุตร (ลาประเภทอื่นนับในช่องลากิจ)
    for (const day of [1, 2, 5, 6, 7, 12]) expect(row.columns.noCheckIn.days).not.toContain(day);
    expect(row.remark).toBe("");
  });

  it("should handle official trips and weekly-plan leave notices", () => {
    const row = buildMonthlyReportRow(base({
      attendance: [{ date: dbDate(10, 14), check_in_time: local(14, 8, 0), check_out_time: local(14, 16, 30), work_type: "official_trip" }],
      exceptions: [
        { date: dbDate(10, 8), type: "official_trip", period: "morning" },
        { date: dbDate(10, 9), type: "leave", period: "full" },
      ],
    }));
    expect(row.columns.officialTrip).toEqual({ days: [8, 14], total: 1.5 });
    expect(row.columns.noCheckIn.days).toContain(8); // ครึ่งวันที่เหลือไม่ได้ลงเวลา
    expect(row.columns.noCheckIn.days).not.toContain(9);
    expect(row.remark).toBe("แจ้งลา(แผนงาน) 9");
  });

  it("should shift the late threshold for an approved morning exception", () => {
    const row = buildMonthlyReportRow(base({
      attendance: [{ date: dbDate(10, 8), check_in_time: local(8, 12, 50), check_out_time: local(8, 16, 30), work_type: "office" }],
      exceptions: [{ date: dbDate(10, 8), type: "leave", period: "morning" }],
    }));
    expect(row.columns.late.days).not.toContain(8);
  });
});

describe("countPersonnelTypes", () => {
  it("should follow the form rows and append unknown types and missing data", () => {
    const result = countPersonnelTypes(["ข้าราชการ", "ข้าราชการ", "พนักงานกระทรวงสาธารณสุข", null]);
    expect(result.total).toBe(4);
    expect(result.rows).toEqual([
      { label: "ข้าราชการ", count: 2 },
      { label: "ลูกจ้างประจำ", count: 0 },
      { label: "พนักงานราชการ", count: 0 },
      { label: "ลูกจ้างชั่วคราว", count: 0 },
      { label: "มาช่วยราชการ", count: 0 },
      { label: "พนักงานกระทรวงสาธารณสุข", count: 1 },
      { label: "ไม่พบข้อมูลประเภทบุคลากร", count: 1 },
    ]);
  });
});
