import { describe, expect, it } from "vitest";
import {
  assertSqlIdentifier,
  isExcludedLeaveType,
  mapLeaveStatus,
  normalizeCid,
  parseLastLeaveSync,
  summarizeLeaveSync,
  pickExternalName,
  toUtcDateOnly,
  transformRemoteLeave,
  type RemoteLeaveRow,
} from "./leave-source";

const baseRow: RemoteLeaveRow = {
  id: 4489,
  cid: "1-2345-67890-12-3",
  external_name: "  สมชาย   ใจดี ",
  leave_type_name: "ลาป่วย",
  start_date: "2026-10-21",
  end_date: "2026-10-22",
  total_days: "2.0",
  reason: "ไข้หวัด",
  status: "approved",
  step1_status: "approved",
  step2_status: "approved",
};

describe("normalizeCid", () => {
  it("should strip dashes and require 13 digits", () => {
    expect(normalizeCid("1-2345-67890-12-3")).toBe("1234567890123");
    expect(normalizeCid("12345")).toBeNull();
    expect(normalizeCid(null)).toBeNull();
  });
});

describe("mapLeaveStatus", () => {
  it("should keep known statuses and default the rest to pending", () => {
    expect(mapLeaveStatus("approved")).toBe("approved");
    expect(mapLeaveStatus("cancelled")).toBe("cancelled");
    expect(mapLeaveStatus("step1_approved")).toBe("step1_approved");
    expect(mapLeaveStatus("unknown")).toBe("pending");
    expect(mapLeaveStatus(null)).toBe("pending");
  });
});

describe("toUtcDateOnly", () => {
  it("should parse YYYY-MM-DD as UTC midnight", () => {
    expect(toUtcDateOnly("2026-10-21")?.toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });

  it("should reject invalid dates", () => {
    expect(toUtcDateOnly("2026-02-30")).toBeNull();
    expect(toUtcDateOnly("21/10/2569")).toBeNull();
    expect(toUtcDateOnly(null)).toBeNull();
  });
});

describe("isExcludedLeaveType", () => {
  it("should exclude WFH types", () => {
    expect(isExcludedLeaveType("WFH")).toBe(true);
    expect(isExcludedLeaveType("ปฏิบัติงานที่บ้าน")).toBe(true);
    expect(isExcludedLeaveType("ลาพักผ่อน")).toBe(false);
  });
});

describe("transformRemoteLeave", () => {
  it("should transform a valid row", () => {
    const result = transformRemoteLeave(baseRow);
    expect(result).toEqual({
      ok: true,
      data: {
        sourceRecordId: "4489",
        cid: "1234567890123",
        fullName: "สมชาย ใจดี",
        leaveTypeName: "ลาป่วย",
        startDate: new Date(Date.UTC(2026, 9, 21)),
        endDate: new Date(Date.UTC(2026, 9, 22)),
        totalDays: 2,
        reason: "ไข้หวัด",
        status: "approved",
        step1Status: "approved",
        step2Status: "approved",
      },
    });
  });

  it("should skip excluded types, rows without identity and invalid dates", () => {
    expect(transformRemoteLeave({ ...baseRow, leave_type_name: "WFH" })).toEqual({ ok: false, reason: "excluded_type" });
    expect(transformRemoteLeave({ ...baseRow, cid: null, external_name: " " })).toEqual({ ok: false, reason: "no_identity" });
    expect(transformRemoteLeave({ ...baseRow, start_date: "2026-10-22", end_date: "2026-10-21" })).toEqual({
      ok: false,
      reason: "invalid_date",
    });
  });

  it("should cancel both approval steps when the leave was cancelled", () => {
    const result = transformRemoteLeave({ ...baseRow, status: "cancelled" });
    expect(result.ok && [result.data.status, result.data.step1Status, result.data.step2Status]).toEqual([
      "cancelled",
      "cancelled",
      "cancelled",
    ]);
  });

  it("should fall back for missing end date, days and type", () => {
    const result = transformRemoteLeave({ ...baseRow, end_date: null, total_days: null, leave_type_name: null });
    expect(result.ok && result.data.endDate.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(result.ok && result.data.totalDays).toBe(1);
    expect(result.ok && result.data.leaveTypeName).toBe("อื่นๆ");
  });
});

describe("pickExternalName", () => {
  it("should drop the name when a user is matched", () => {
    expect(pickExternalName(true, "ก", "ข")).toBeNull();
  });

  it("should prefer the source name and keep the existing one when the source has none", () => {
    expect(pickExternalName(false, "ก", "ข")).toBe("ก");
    expect(pickExternalName(false, null, "ข")).toBe("ข");
    expect(pickExternalName(false, null, undefined)).toBeNull();
  });
});

describe("assertSqlIdentifier", () => {
  it("should accept plain identifiers and reject anything else", () => {
    expect(assertSqlIdentifier("leave_types", "table")).toBe("leave_types");
    expect(() => assertSqlIdentifier("name; DROP TABLE x", "column")).toThrow();
    expect(() => assertSqlIdentifier("", "column")).toThrow();
  });
});

describe("parseLastLeaveSync", () => {
  it("should parse a stored result", () => {
    const raw = JSON.stringify({ at: "2026-10-20T05:32:00.000Z", trigger: "cron", ok: true, message: "อ่าน 1" });
    expect(parseLastLeaveSync(raw)).toEqual({ at: "2026-10-20T05:32:00.000Z", trigger: "cron", ok: true, message: "อ่าน 1" });
  });

  it("should return null for empty or broken values", () => {
    expect(parseLastLeaveSync(null)).toBeNull();
    expect(parseLastLeaveSync("not json")).toBeNull();
    expect(parseLastLeaveSync(JSON.stringify({ at: "yesterday" }))).toBeNull();
  });
});

describe("summarizeLeaveSync", () => {
  it("should only mention failures when there are any", () => {
    const base = { fetchedCount: 10, createdCount: 2, updatedCount: 7, skippedCount: 1, failedCount: 0 };
    expect(summarizeLeaveSync(base)).toBe("อ่าน 10 เพิ่มใหม่ 2 อัปเดต 7 ข้าม 1");
    expect(summarizeLeaveSync({ ...base, failedCount: 3 })).toBe("อ่าน 10 เพิ่มใหม่ 2 อัปเดต 7 ข้าม 1 ผิดพลาด 3");
  });
});
