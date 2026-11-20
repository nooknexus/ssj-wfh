import { describe, expect, it } from "vitest";
import { selectCheckInReminderCids } from "./checkin-reminder";

const cid = (n: number) => String(1000000000000 + n);
const users = [1, 2, 3, 4, 5, 6].map((id) => ({ id, username: cid(id) }));

describe("selectCheckInReminderCids", () => {
  it("should remind everyone who has not checked in", () => {
    expect(selectCheckInReminderCids({ users, checkedInUserIds: [1, 2], onLeaveUserIds: [], exceptions: [] })).toEqual([
      cid(3),
      cid(4),
      cid(5),
      cid(6),
    ]);
  });

  it("should skip approved leave and plan exceptions that cover the morning", () => {
    const result = selectCheckInReminderCids({
      users,
      checkedInUserIds: [],
      onLeaveUserIds: [1],
      exceptions: [
        { user_id: 2, period: "full" },
        { user_id: 3, period: "morning" },
        { user_id: 4, period: "afternoon" },
      ],
    });
    // คนที่ 4 ลาแค่ครึ่งบ่าย ช่วงเช้ายังต้องลงเวลา
    expect(result).toEqual([cid(4), cid(5), cid(6)]);
  });

  it("should skip users without a valid 13-digit citizen ID", () => {
    const result = selectCheckInReminderCids({
      users: [{ id: 1, username: "abc" }, { id: 2, username: null }, { id: 3, username: cid(3) }],
      checkedInUserIds: [],
      onLeaveUserIds: [],
      exceptions: [],
    });
    expect(result).toEqual([cid(3)]);
  });
});
