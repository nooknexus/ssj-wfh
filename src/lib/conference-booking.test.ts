import { describe, expect, it } from "vitest";
import {
  blocksAvailability,
  combineDateTime,
  getHalfHourSlots,
  getLinkAvailability,
  intervalsOverlap,
  validateBookingRequest,
} from "./conference-booking";

const at = (value: string) => new Date(`2026-10-20T${value}:00.000Z`);

describe("intervalsOverlap", () => {
  it("detects partial and containing overlaps but permits adjacent reservations", () => {
    expect(intervalsOverlap({ startAt: at("10:00"), endAt: at("11:00") }, { startAt: at("10:30"), endAt: at("11:30") })).toBe(true);
    expect(intervalsOverlap({ startAt: at("10:00"), endAt: at("12:00") }, { startAt: at("10:30"), endAt: at("11:30") })).toBe(true);
    expect(intervalsOverlap({ startAt: at("10:00"), endAt: at("11:00") }, { startAt: at("11:00"), endAt: at("12:00") })).toBe(false);
  });
});

describe("blocksAvailability", () => {
  it("reserves a link only for pending and approved bookings", () => {
    expect(blocksAvailability("pending")).toBe(true);
    expect(blocksAvailability("approved")).toBe(true);
    expect(blocksAvailability("rejected")).toBe(false);
    expect(blocksAvailability("cancelled")).toBe(false);
  });
});

describe("validateBookingRequest", () => {
  const now = at("09:00");

  it("returns a precise reason for invalid dates, duration, and capacity", () => {
    expect(validateBookingRequest({ startAt: at("11:00"), endAt: at("10:00"), attendees: 1, now })).toEqual({ valid: false, code: "end_before_start" });
    expect(validateBookingRequest({ startAt: at("10:00"), endAt: at("18:01"), attendees: 1, now })).toEqual({ valid: false, code: "duration_too_long" });
    expect(validateBookingRequest({ startAt: at("08:59"), endAt: at("10:00"), attendees: 1, now })).toEqual({ valid: false, code: "start_in_past" });
    expect(validateBookingRequest({ startAt: at("10:00"), endAt: at("11:00"), attendees: 101, maxParticipants: 100, now })).toEqual({ valid: false, code: "capacity_exceeded" });
  });

  it("accepts a future booking at the maximum participant cap", () => {
    expect(validateBookingRequest({ startAt: at("10:00"), endAt: at("11:00"), attendees: 100, maxParticipants: 100, now })).toEqual({ valid: true });
  });
});

describe("getLinkAvailability", () => {
  const requested = { startAt: at("10:00"), endAt: at("11:00") };

  it("classifies inactive, over-capacity, and reserved links before available links", () => {
    expect(getLinkAvailability({ isActive: false, attendees: 1, bookings: [], requested })).toBe("inactive");
    expect(getLinkAvailability({ isActive: true, maxParticipants: 100, attendees: 101, bookings: [], requested })).toBe("capacity_exceeded");
    expect(getLinkAvailability({ isActive: true, attendees: 1, requested, bookings: [{ ...requested, status: "pending" }] })).toBe("unavailable");
    expect(getLinkAvailability({ isActive: true, attendees: 1, requested, bookings: [{ ...requested, status: "rejected" }] })).toBe("available");
  });
});

describe("getHalfHourSlots", () => {
  it("offers every half-hour from 07:00 through 20:00", () => {
    const slots = getHalfHourSlots();
    expect(slots).toHaveLength(27);
    expect(slots[0]).toBe("07:00");
    expect(slots.at(-1)).toBe("20:00");
    expect(slots).toContain("12:30");
  });
});

describe("combineDateTime", () => {
  it("should build a local date-time", () => {
    const value = combineDateTime("2099-10-21", "13:30");
    expect(value && [value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes()]).toEqual([2099, 9, 21, 13, 30]);
  });

  it("should reject malformed input", () => {
    expect(combineDateTime("21/10/2099", "13:30")).toBeNull();
    expect(combineDateTime("2099-10-21", "1:30")).toBeNull();
  });
});
