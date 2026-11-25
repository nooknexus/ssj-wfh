import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportRow,
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
    expect(row.columns.noCheckOut).toEqual({ days: [2], total: 1 });
    expect(row.columns.noCheckIn.days).not.toContain(1);
  });

  it("should leave the leave columns blank and list leave days in the remark", () => {
    const row = buildMonthlyReportRow(base({
      leaves: [
        { start_date: dbDate(9, 29), end_date: dbDate(10, 2), total_days: 4 },
        { start_date: dbDate(10, 5), end_date: dbDate(10, 6), total_days: 2 },
        { start_date: dbDate(10, 7), end_date: dbDate(10, 7), total_days: 0.5 },
        { start_date: dbDate(10, 12), end_date: dbDate(10, 12), total_days: 1 },
      ],
    }));
    // ประเภทลาให้เจ้าหน้าที่เขียนเองหลังพิมพ์ ระบบบอกเฉพาะวันที่ลาในหมายเหตุ
    for (const column of ["vacation", "sick", "personal"] as const) {
      expect(row.columns[column]).toEqual({ days: [], total: 0 });
    }
    for (const day of [1, 2, 5, 6, 7, 12]) expect(row.columns.noCheckIn.days).not.toContain(day);
    expect(row.remark).toBe("ลา 1, 2, 5, 6, 7 (ครึ่งวัน), 12"); // ลากิจวันที่ 7 ครึ่งวัน
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
    expect(row.remark).toBe("ลา 9");
  });

  it("should list the users' own remarks by day after the leave days", () => {
    const row = buildMonthlyReportRow(base({
      attendance: [
        { date: dbDate(10, 13), check_in_time: local(13, 8, 50), check_out_time: local(13, 16, 30), work_type: "office", remark: "  รถติดมาก " },
        { date: dbDate(10, 1), check_in_time: local(1, 8, 0), check_out_time: local(1, 16, 30), work_type: "office", remark: "ประชุมนอกสถานที่" },
        { date: dbDate(10, 2), check_in_time: local(2, 8, 0), check_out_time: local(2, 16, 30), work_type: "office", remark: "ประชุมนอกสถานที่" },
        { date: dbDate(10, 5), check_in_time: local(5, 8, 0), check_out_time: local(5, 16, 30), work_type: "office", remark: "ประชุมนอกสถานที่" },
        { date: dbDate(10, 6), check_in_time: local(6, 8, 0), check_out_time: local(6, 16, 30), work_type: "office", remark: "   " },
      ],
      exceptions: [{ date: dbDate(10, 9), type: "leave", period: "full" }],
    }));
    expect(row.remark).toBe("ลา 9\n1, 2, 5: ประชุมนอกสถานที่\n13: รถติดมาก");
  });

  it("should show remarks alone when there are no plan notices", () => {
    const row = buildMonthlyReportRow(base({
      attendance: [{ date: dbDate(10, 20), check_in_time: local(20, 9, 0), check_out_time: null, work_type: "office", remark: "ลืมลงเวลาออก" }],
    }));
    expect(row.remark).toBe("20: ลืมลงเวลาออก");
  });

  it("should mark half-day leaves in the remark", () => {
    const row = buildMonthlyReportRow(base({
      leaves: [
        { start_date: dbDate(10, 5), end_date: dbDate(10, 7), total_days: 3 },
        { start_date: dbDate(10, 12), end_date: dbDate(10, 12), total_days: 0.5 },
      ],
      exceptions: [
        { date: dbDate(10, 9), type: "leave", period: "morning" },
        { date: dbDate(10, 14), type: "leave", period: "afternoon" },
        { date: dbDate(10, 6), type: "leave", period: "morning" }, // ซ้ำกับใบลาเต็มวัน ให้นับเต็มวัน
      ],
    }));
    expect(row.remark).toBe("ลา 5–7, 9 (ครึ่งเช้า), 12 (ครึ่งวัน), 14 (ครึ่งบ่าย)");
  });

  it("should not count late or missing check-out on leave or official-trip days", () => {
    const row = buildMonthlyReportRow(base({
      attendance: [
        // ลาครึ่งบ่ายในแผนงาน: มาตอนเช้าตามเวลา ไม่ได้สแกนออก
        { date: dbDate(10, 1), check_in_time: local(1, 8, 20), check_out_time: null, work_type: "office" },
        // ไปราชการครึ่งบ่าย: ไม่ได้สแกนออก
        { date: dbDate(10, 2), check_in_time: local(2, 8, 20), check_out_time: null, work_type: "office" },
        // ใบลาครึ่งวันจากระบบลา: มาช่วงบ่าย ไม่ได้สแกนออก
        { date: dbDate(10, 5), check_in_time: local(5, 12, 55), check_out_time: null, work_type: "office" },
        // ลงเวลาแบบไปราชการ: สายแต่ไม่นับ
        { date: dbDate(10, 6), check_in_time: local(6, 10, 0), check_out_time: local(6, 16, 30), work_type: "official_trip" },
        // วันปกติ: สายและไม่สแกนออกยังนับ
        { date: dbDate(10, 7), check_in_time: local(7, 9, 0), check_out_time: null, work_type: "office" },
      ],
      leaves: [{ start_date: dbDate(10, 5), end_date: dbDate(10, 5), total_days: 0.5 }],
      exceptions: [
        { date: dbDate(10, 1), type: "leave", period: "afternoon" },
        { date: dbDate(10, 2), type: "official_trip", period: "afternoon" },
      ],
    }));
    expect(row.columns.late).toEqual({ days: [7], total: 1 });
    expect(row.columns.noCheckOut).toEqual({ days: [7], total: 1 });
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
