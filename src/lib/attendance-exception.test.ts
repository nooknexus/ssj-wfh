import { describe, expect, it } from "vitest";
import {
  blocksCheckIn,
  describeException,
  getLateThreshold,
  mergeApprovedPeriods,
  periodsConflict,
  resolveExceptionStatus,
  skipsCheckoutReminder,
  validateExceptionDate,
} from "./attendance-exception";

// 2026-10-19 เป็นวันจันทร์
const monday = new Date(2026, 9, 19, 12);
const tuesday = new Date(2026, 9, 20, 12);
const saturday = new Date(2026, 9, 24, 12);

describe("periodsConflict", () => {
  it("should conflict when either side is full day", () => {
    expect(periodsConflict("full", "morning")).toBe(true);
    expect(periodsConflict("afternoon", "full")).toBe(true);
  });

  it("should conflict for the same half and allow morning with afternoon", () => {
    expect(periodsConflict("morning", "morning")).toBe(true);
    expect(periodsConflict("morning", "afternoon")).toBe(false);
  });
});

describe("validateExceptionDate", () => {
  it("should allow today and future weekdays", () => {
    expect(validateExceptionDate(monday, monday)).toBeNull();
    expect(validateExceptionDate(tuesday, monday)).toBeNull();
  });

  it("should reject weekends and past dates", () => {
    expect(validateExceptionDate(saturday, monday)).not.toBeNull();
    expect(validateExceptionDate(monday, tuesday)).not.toBeNull();
  });
});

describe("getLateThreshold", () => {
  it("should use working time by default", () => {
    const threshold = getLateThreshold(monday, "08:30", "13:00");
    expect([threshold.getHours(), threshold.getMinutes()]).toEqual([8, 30]);
  });

  it("should shift to afternoon start for approved morning exception", () => {
    const threshold = getLateThreshold(monday, "08:30", "13:00", "morning");
    expect([threshold.getHours(), threshold.getMinutes()]).toEqual([13, 0]);
  });

  it("should keep working time for afternoon exception", () => {
    expect(getLateThreshold(monday, "08:30", "13:00", "afternoon").getHours()).toBe(8);
  });
});

describe("blocksCheckIn / skipsCheckoutReminder", () => {
  it("should block check-in only for full day", () => {
    expect(blocksCheckIn("full")).toBe(true);
    expect(blocksCheckIn("morning")).toBe(false);
    expect(blocksCheckIn(null)).toBe(false);
  });

  it("should skip checkout reminder for full day and afternoon", () => {
    expect(skipsCheckoutReminder("full")).toBe(true);
    expect(skipsCheckoutReminder("afternoon")).toBe(true);
    expect(skipsCheckoutReminder("morning")).toBe(false);
  });
});

describe("resolveExceptionStatus", () => {
  it("should map full-day exceptions to leave or official_trip", () => {
    expect(resolveExceptionStatus({ type: "leave", period: "full" }).status).toBe("leave");
    expect(resolveExceptionStatus({ type: "official_trip", period: "full", location: "สสอ.เมือง" })).toEqual({
      status: "official_trip",
      tasks: "แจ้งไปราชการเต็มวัน (แผนงาน): สสอ.เมือง",
    });
  });

  it("should mark half-day exceptions without attendance as absent with a note", () => {
    const result = resolveExceptionStatus({ type: "leave", period: "morning", reason: "ธุระส่วนตัว" });
    expect(result.status).toBe("absent");
    expect(result.tasks).toBe("แจ้งลาครึ่งเช้า (แผนงาน): ธุระส่วนตัว / ไม่ได้ลงเวลาช่วงบ่าย");
  });
});

describe("describeException", () => {
  it("should omit details when none are given", () => {
    expect(describeException({ type: "leave", period: "afternoon" })).toBe("แจ้งลาครึ่งบ่าย (แผนงาน)");
  });
});

describe("mergeApprovedPeriods", () => {
  it("should treat morning plus afternoon as full day", () => {
    expect(mergeApprovedPeriods(["morning", "afternoon"])).toBe("full");
    expect(mergeApprovedPeriods(["afternoon", "full"])).toBe("full");
  });

  it("should return the single period or null", () => {
    expect(mergeApprovedPeriods(["morning"])).toBe("morning");
    expect(mergeApprovedPeriods([])).toBeNull();
  });
});
