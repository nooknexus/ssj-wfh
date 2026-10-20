import { describe, expect, it, vi } from "vitest";
import { meetingRouter } from "./meeting";

const at = (value: string) => new Date(`2026-10-21T${value}:00.000Z`);

const createCaller = (roles: string[], db: Record<string, unknown>) =>
  meetingRouter.createCaller({
    session: { user: { id: "1", roles } } as never,
    db: db as never,
  });

const booking = (status: "pending" | "approved" | "rejected" | "cancelled") => ({
  id: 5,
  user_id: 1,
  link_id: 2,
  status,
  title: "ประชุมทดสอบ",
  start_at: at("10:00"),
  end_at: at("11:00"),
  link: { id: 2, name: "Zoom 1", platform: "zoom", url: "https://secret.example/room" },
});

describe("meetingRouter authorization and disclosure", () => {
  it("rejects direct administrator calls by a regular user", async () => {
    const caller = createCaller(["staff"], {});

    await expect(caller.getAllBookings()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a conference URL only for an approved booking", async () => {
    const caller = createCaller(["staff"], {
      meetingBooking: { findMany: vi.fn().mockResolvedValue([booking("pending"), booking("approved")]) },
    });

    const result = await caller.getMyBookings();

    expect(result[0].link.url).toBeUndefined();
    expect(result[1].link.url).toBe("https://secret.example/room");
  });
});

describe("meetingRouter conflicts", () => {
  it("marks an active link unavailable when its related pending booking overlaps", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: 2,
      name: "Zoom 1",
      platform: "zoom",
      is_active: true,
      max_participants: 100,
      sort_order: 0,
      bookings: [{ start_at: at("10:00"), end_at: at("11:00"), status: "pending" }],
    }]);
    const caller = createCaller(["staff"], { conferenceLink: { findMany } });

    const result = await caller.getAvailableLinks({ startAt: at("10:00"), endAt: at("11:00"), attendees: 10 });

    expect(result[0].availability).toBe("unavailable");
    expect(findMany.mock.calls[0][0].include.bookings.where).not.toHaveProperty("link_id");
  });

  it("refuses a pending booking that overlaps a pending reservation", async () => {
    const transaction = {
      conferenceLink: { findUnique: vi.fn().mockResolvedValue({ id: 2, is_active: true, max_participants: 100 }) },
      meetingBooking: { findFirst: vi.fn().mockResolvedValue({ id: 99 }) },
    };
    const caller = createCaller(["staff"], { $transaction: vi.fn((callback) => callback(transaction)) });

    await expect(caller.createBooking({ linkId: 2, title: "ประชุม", startAt: at("10:00"), endAt: at("11:00"), attendees: 10 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses approval when another reservation now overlaps", async () => {
    const transaction = {
      meetingBooking: {
        findUnique: vi.fn().mockResolvedValue(booking("pending")),
        findFirst: vi.fn().mockResolvedValue({ id: 99 }),
      },
    };
    const caller = createCaller(["itadmin"], { $transaction: vi.fn((callback) => callback(transaction)) });

    await expect(caller.updateBookingStatus({ id: 5, status: "approved" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
