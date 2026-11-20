import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  systemSetting: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  attendanceRecord: { findMany: vi.fn() },
  leaveRequest: { findMany: vi.fn() },
  attendanceException: { findMany: vi.fn() },
}));
const alert = vi.hoisted(() => ({ sendMophAlert: vi.fn(), getCheckInReminderFlexMessage: vi.fn(() => ({ type: "flex" })) }));
const holidays = vi.hoisted(() => ({ getThaiHolidaysForRange: vi.fn(), isHoliday: vi.fn() }));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/lib/moph-alert", () => alert);
vi.mock("@/server/utils/holidays", () => holidays);

import { GET } from "./route";

const request = (token?: string) =>
  new Request("http://localhost/api/cron/checkin-reminder", token ? { headers: { authorization: `Bearer ${token}` } } : {});

describe("GET /api/cron/checkin-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T09:00:00")); // วันศุกร์
    vi.stubEnv("CRON_SECRET", "s3cret");
    db.systemSetting.findUnique.mockResolvedValue(null);
    holidays.getThaiHolidaysForRange.mockResolvedValue([]);
    holidays.isHoliday.mockReturnValue(false);
    db.user.findMany.mockResolvedValue([
      { id: 1, username: "1000000000001" },
      { id: 2, username: "1000000000002" },
      { id: 3, username: "1000000000003" },
    ]);
    db.attendanceRecord.findMany.mockResolvedValue([{ user_id: 1 }]);
    db.leaveRequest.findMany.mockResolvedValue([{ user_id: 2 }]);
    db.attendanceException.findMany.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401);
    expect(alert.sendMophAlert).not.toHaveBeenCalled();
  });

  it("reminds only active users who have neither checked in nor taken leave", async () => {
    const response = await GET(request("s3cret"));

    expect(await response.json()).toMatchObject({ success: true, notified_count: 1 });
    expect(alert.sendMophAlert).toHaveBeenCalledWith(expect.objectContaining({ cid: ["1000000000003"] }));
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "active" } }));
  });

  it("does nothing when the reminder is switched off", async () => {
    db.systemSetting.findUnique.mockResolvedValue({ setting_value: "false" });

    await GET(request("s3cret"));
    expect(alert.sendMophAlert).not.toHaveBeenCalled();
  });

  it("does nothing on a public holiday", async () => {
    holidays.isHoliday.mockReturnValue(true);

    expect(await (await GET(request("s3cret"))).json()).toMatchObject({ notified_count: 0 });
    expect(alert.sendMophAlert).not.toHaveBeenCalled();
  });

  it("does nothing on a weekend", async () => {
    vi.setSystemTime(new Date("2026-11-21T09:00:00")); // วันเสาร์

    await GET(request("s3cret"));
    expect(alert.sendMophAlert).not.toHaveBeenCalled();
  });
});
