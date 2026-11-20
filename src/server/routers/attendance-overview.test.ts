import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/holidays", () => ({
  getThaiHolidaysForRange: vi.fn().mockResolvedValue([]),
  isHoliday: vi.fn().mockReturnValue(false),
}));

import { attendanceRouter } from "./attendance";

const createDb = (departmentId: number | null) => {
  const userFindMany = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
  return {
    userFindMany,
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ department_id: departmentId }),
        findMany: userFindMany,
      },
      attendanceRecord: { findMany: vi.fn().mockResolvedValue([]) },
      leaveRequest: { findMany: vi.fn().mockResolvedValue([{ user_id: 2 }, { user_id: null }]) },
      attendanceException: { findMany: vi.fn().mockResolvedValue([]) },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    },
  };
};

const createCaller = (roles: string[], db: Record<string, unknown>) =>
  attendanceRouter.createCaller({
    session: { user: { id: "9", roles } } as never,
    db: db as never,
  });

describe("attendance.getTodayOverview", () => {
  it("rejects regular staff", async () => {
    const { db } = createDb(3);
    await expect(createCaller(["staff"], db).getTodayOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("limits a leader to active users of their own department", async () => {
    const { db, userFindMany } = createDb(3);
    const result = await createCaller(["leader"], db).getTodayOverview();

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "active", department_id: 3 } }),
    );
    expect(result).toMatchObject({ total: 2, onLeave: 1, notCheckedIn: 1 });
  });

  it("shows HR every active user", async () => {
    const { db, userFindMany } = createDb(3);
    await createCaller(["hradmin"], db).getTodayOverview();

    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "active" } }));
  });

  it("rejects a leader without a department", async () => {
    const { db } = createDb(null);
    await expect(createCaller(["leader"], db).getTodayOverview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("attendance.getMyMonthOverview", () => {
  it("reads only the signed-in user's own records for any role", async () => {
    const recordFindMany = vi.fn().mockResolvedValue([]);
    const leaveFindMany = vi.fn().mockResolvedValue([]);
    const exceptionFindMany = vi.fn().mockResolvedValue([]);
    const db = {
      attendanceRecord: { findMany: recordFindMany },
      leaveRequest: { findMany: leaveFindMany },
      attendanceException: { findMany: exceptionFindMany },
      systemSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await createCaller(["staff"], db).getMyMonthOverview();

    for (const findMany of [recordFindMany, leaveFindMany, exceptionFindMany]) {
      expect(findMany.mock.calls[0][0].where.user_id).toBe(9);
    }
    expect(result.onTime).toBe(0);
  });
});

describe("attendance.updateRemark", () => {
  it("saves a trimmed remark on the user's own record", async () => {
    const update = vi.fn().mockResolvedValue({ id: 4, remark: "รถติดมาก" });
    const db = { attendanceRecord: { findFirst: vi.fn().mockResolvedValue({ id: 4 }), update } };

    await createCaller(["staff"], db).updateRemark({ id: 4, remark: "  รถติดมาก  " });

    expect(db.attendanceRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4, user_id: 9 } }));
    expect(update).toHaveBeenCalledWith({ where: { id: 4 }, data: { remark: "รถติดมาก" } });
  });

  it("clears the remark when it is left empty", async () => {
    const update = vi.fn().mockResolvedValue({ id: 4, remark: null });
    const db = { attendanceRecord: { findFirst: vi.fn().mockResolvedValue({ id: 4 }), update } };

    await createCaller(["staff"], db).updateRemark({ id: 4, remark: "   " });

    expect(update).toHaveBeenCalledWith({ where: { id: 4 }, data: { remark: null } });
  });

  it("refuses to edit someone else's record", async () => {
    const update = vi.fn();
    const db = { attendanceRecord: { findFirst: vi.fn().mockResolvedValue(null), update } };

    await expect(createCaller(["hradmin"], db).updateRemark({ id: 99, remark: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects remarks that are too long", async () => {
    const db = { attendanceRecord: { findFirst: vi.fn(), update: vi.fn() } };
    await expect(createCaller(["staff"], db).updateRemark({ id: 4, remark: "ก".repeat(501) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

