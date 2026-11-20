import { describe, expect, it } from "vitest";
import { formatWorkedDuration, getWorkProgress, isCheckoutTasksRequired, isManualLocationAllowed } from "./attendance-utils";

describe("isManualLocationAllowed", () => {
  it("should return true when setting is undefined or null", () => {
    expect(isManualLocationAllowed(undefined)).toBe(true);
    expect(isManualLocationAllowed(null)).toBe(true);
  });

  it("should return true when setting is 'true'", () => {
    expect(isManualLocationAllowed("true")).toBe(true);
    expect(isManualLocationAllowed("TRUE")).toBe(true);
  });

  it("should return false when setting is 'false'", () => {
    expect(isManualLocationAllowed("false")).toBe(false);
    expect(isManualLocationAllowed("FALSE")).toBe(false);
  });

  it("should return true for any other non-false string value", () => {
    expect(isManualLocationAllowed("1")).toBe(true);
    expect(isManualLocationAllowed("enabled")).toBe(true);
  });
});

describe("getWorkProgress", () => {
  const at = (time: string) => new Date(`2026-10-21T${time}:00`);

  it("should end 8 hours after check-in when checking in after the start time", () => {
    const progress = getWorkProgress(at("08:52"), at("12:01"), { workingTime: "08:30" });
    expect(progress.workedMinutes).toBe(189);
    expect(progress.endTime).toEqual(at("16:52"));
    expect(progress.percent).toBeCloseTo((189 / 480) * 100);
  });

  it("should start counting at the start time when checking in early", () => {
    const progress = getWorkProgress(at("08:00"), at("09:30"), { workingTime: "08:30" });
    expect(progress.workedMinutes).toBe(60);
    expect(progress.endTime).toEqual(at("16:30"));
    expect(progress.percent).toBeCloseTo(12.5);
  });

  it("should show zero before the start time", () => {
    const progress = getWorkProgress(at("08:00"), at("08:15"), { workingTime: "08:30" });
    expect(progress.workedMinutes).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it("should cap the progress at 100% after the end time", () => {
    const progress = getWorkProgress(at("08:30"), at("17:45"), { workingTime: "08:30" });
    expect(progress.workedMinutes).toBe(555);
    expect(progress.percent).toBe(100);
  });

  it("should require a full 8 hours however late the check-in is", () => {
    const progress = getWorkProgress(at("10:15"), at("18:15"), { workingTime: "08:30" });
    expect(progress.endTime).toEqual(at("18:15"));
    expect(progress.percent).toBe(100);
  });

  it("should count 8 hours on a normal day", () => {
    expect(getWorkProgress(at("08:30"), at("09:00"), { workingTime: "08:30" }).requiredHours).toBe(8);
  });

  describe("half day from the weekly plan", () => {
    const options = { workingTime: "08:30", afternoonStart: "13:00" };

    it("should count 3.5 hours from the afternoon start when the morning is off", () => {
      const progress = getWorkProgress(at("12:40"), at("14:00"), { ...options, exceptionPeriod: "morning" });
      expect(progress.requiredHours).toBe(3.5);
      expect(progress.workedMinutes).toBe(60);
      expect(progress.endTime).toEqual(at("16:30"));
      expect(progress.percent).toBeCloseTo((60 / 210) * 100);
    });

    it("should push the end time back when checking in late for the afternoon", () => {
      const progress = getWorkProgress(at("13:20"), at("14:00"), { ...options, exceptionPeriod: "morning" });
      expect(progress.endTime).toEqual(at("16:50"));
    });

    it("should count 3.5 hours from the morning start when the afternoon is off", () => {
      const progress = getWorkProgress(at("08:45"), at("12:15"), { ...options, exceptionPeriod: "afternoon" });
      expect(progress.requiredHours).toBe(3.5);
      expect(progress.endTime).toEqual(at("12:15"));
      expect(progress.percent).toBe(100);
    });
  });
});

describe("formatWorkedDuration", () => {
  it("should show hours and minutes", () => {
    expect(formatWorkedDuration(189)).toBe("3 ชม. 9 นาที");
    expect(formatWorkedDuration(120)).toBe("2 ชม. 0 นาที");
  });

  it("should show only minutes under an hour", () => {
    expect(formatWorkedDuration(45)).toBe("45 นาที");
    expect(formatWorkedDuration(0)).toBe("0 นาที");
  });
});

describe("isCheckoutTasksRequired", () => {
  it("should require the work summary unless it is switched off", () => {
    expect(isCheckoutTasksRequired(undefined)).toBe(true);
    expect(isCheckoutTasksRequired(null)).toBe(true);
    expect(isCheckoutTasksRequired("true")).toBe(true);
    expect(isCheckoutTasksRequired("false")).toBe(false);
    expect(isCheckoutTasksRequired("FALSE")).toBe(false);
  });
});
