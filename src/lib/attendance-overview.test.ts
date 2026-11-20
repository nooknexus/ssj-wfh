import { describe, expect, it } from "vitest";
import { summarizeMonthToDate, summarizeTodayAttendance, type TodayOverviewInput } from "./attendance-overview";

const OFFICE = { lat: 16.8173716, lng: 100.2584649, radius: 100 };
// ห่างจากสำนักงานไปทางเหนือราว 1.1 กม.
const FAR = { check_in_lat: 16.8273716, check_in_lng: 100.2584649 };
const NEAR = { check_in_lat: OFFICE.lat, check_in_lng: OFFICE.lng };

const at = (time: string) => new Date(`2026-10-21T${time}:00`);

const baseInput = (overrides: Partial<TodayOverviewInput> = {}): TodayOverviewInput => ({
  userIds: [1, 2, 3, 4, 5],
  records: [],
  onLeaveUserIds: [],
  exceptions: [],
  date: at("12:00"),
  workingTime: "08:30",
  afternoonStart: "13:00",
  isHoliday: false,
  office: OFFICE,
  ...overrides,
});

describe("summarizeTodayAttendance", () => {
  it("should count everyone as not checked in when nobody has checked in", () => {
    expect(summarizeTodayAttendance(baseInput())).toEqual({
      total: 5,
      notCheckedIn: 5,
      onTime: 0,
      late: 0,
      outsideArea: 0,
      onLeave: 0,
      officialTrip: 0,
    });
  });

  it("should split check-ins into on time and late by the start time", () => {
    const summary = summarizeTodayAttendance(baseInput({
      records: [
        { user_id: 1, work_type: "office", check_in_time: at("08:20"), ...NEAR },
        { user_id: 2, work_type: "wfh", check_in_time: at("08:45"), ...FAR },
      ],
    }));
    expect(summary).toMatchObject({ onTime: 1, late: 1, notCheckedIn: 3 });
  });

  it("should never count onsite or holiday check-ins as late", () => {
    const records = [{ user_id: 1, work_type: "onsite", check_in_time: at("10:00"), ...FAR }];
    expect(summarizeTodayAttendance(baseInput({ records })).late).toBe(0);
    const officeLate = [{ user_id: 1, work_type: "office", check_in_time: at("10:00"), ...NEAR }];
    expect(summarizeTodayAttendance(baseInput({ records: officeLate, isHoliday: true })).late).toBe(0);
  });

  it("should move the late threshold to the afternoon for an approved morning off", () => {
    const summary = summarizeTodayAttendance(baseInput({
      records: [{ user_id: 1, work_type: "office", check_in_time: at("12:50"), ...NEAR }],
      exceptions: [{ user_id: 1, period: "morning", type: "leave" }],
    }));
    expect(summary).toMatchObject({ onTime: 1, late: 0 });
  });

  it("should flag office check-ins outside the radius on top of on time or late", () => {
    const summary = summarizeTodayAttendance(baseInput({
      records: [
        { user_id: 1, work_type: "office", check_in_time: at("08:20"), ...FAR },
        { user_id: 2, work_type: "office", check_in_time: at("08:20"), ...NEAR },
        { user_id: 3, work_type: "wfh", check_in_time: at("08:20"), ...FAR },
      ],
    }));
    expect(summary).toMatchObject({ onTime: 3, outsideArea: 1 });
  });

  it("should not flag an office check-in without coordinates", () => {
    const summary = summarizeTodayAttendance(baseInput({
      records: [{ user_id: 1, work_type: "office", check_in_time: at("08:20"), check_in_lat: null, check_in_lng: null }],
    }));
    expect(summary.outsideArea).toBe(0);
  });

  it("should count approved leave and full-day plan exceptions as on leave", () => {
    const summary = summarizeTodayAttendance(baseInput({
      onLeaveUserIds: [1],
      exceptions: [
        { user_id: 2, period: "full", type: "leave" },
        { user_id: 3, period: "morning", type: "leave" },
        { user_id: 3, period: "afternoon", type: "leave" },
        { user_id: 4, period: "morning", type: "leave" },
      ],
    }));
    expect(summary).toMatchObject({ onLeave: 3, notCheckedIn: 2, officialTrip: 0 });
  });

  it("should count a full-day official trip from the plan separately from leave", () => {
    const summary = summarizeTodayAttendance(baseInput({
      exceptions: [
        { user_id: 1, period: "full", type: "official_trip" },
        { user_id: 2, period: "morning", type: "official_trip" },
        { user_id: 2, period: "afternoon", type: "official_trip" },
        { user_id: 3, period: "morning", type: "official_trip" },
        { user_id: 4, period: "morning", type: "official_trip" },
        { user_id: 4, period: "afternoon", type: "leave" },
      ],
    }));
    // คนที่ 3 ไปราชการแค่ครึ่งเช้า ยังต้องลงเวลาช่วงบ่าย, คนที่ 4 มีลาปนอยู่จึงนับเป็นลา
    expect(summary).toMatchObject({ officialTrip: 2, onLeave: 1, notCheckedIn: 2 });
  });

  it("should count an approved leave request as leave even with an official trip in the plan", () => {
    const summary = summarizeTodayAttendance(baseInput({
      onLeaveUserIds: [1],
      exceptions: [{ user_id: 1, period: "full", type: "official_trip" }],
    }));
    expect(summary).toMatchObject({ onLeave: 1, officialTrip: 0 });
  });

  it("should count someone who checked in despite a leave as checked in", () => {
    const summary = summarizeTodayAttendance(baseInput({
      records: [{ user_id: 1, work_type: "office", check_in_time: at("08:20"), ...NEAR }],
      onLeaveUserIds: [1],
    }));
    expect(summary).toMatchObject({ onTime: 1, onLeave: 0 });
  });

  it("should ignore records of users outside the scope", () => {
    const summary = summarizeTodayAttendance(baseInput({
      userIds: [1],
      records: [{ user_id: 99, work_type: "office", check_in_time: at("08:20"), ...NEAR }],
      onLeaveUserIds: [98],
    }));
    expect(summary).toMatchObject({ total: 1, notCheckedIn: 1, onTime: 0, onLeave: 0 });
  });
});

describe("summarizeMonthToDate", () => {
  // ตุลาคม 2026: วันที่ 1 เป็นวันพฤหัสบดี, 3–4 และ 10–11 เป็นเสาร์-อาทิตย์
  const day = (date: number, time = "12:00") => new Date(`2026-10-${String(date).padStart(2, "0")}T${time}:00`);
  const base = {
    today: day(13, "10:00"),
    records: [] as TodayOverviewInput["records"],
    leaves: [] as { start_date: Date; end_date: Date }[],
    exceptions: [] as { date: Date; period: "full" | "morning" | "afternoon"; type: "leave" | "official_trip" }[],
    isHolidayDate: () => false,
    workingTime: "08:30",
    afternoonStart: "13:00",
    office: OFFICE,
  };
  const record = (date: number, time: string, extra: Partial<TodayOverviewInput["records"][number]> = {}) => ({
    user_id: 0,
    work_type: "office",
    check_in_time: day(date, time),
    ...NEAR,
    ...extra,
  });

  it("should count past working days without a check-in, excluding weekends and today", () => {
    // วันทำการก่อนวันที่ 13: 1, 2, 5, 6, 7, 8, 9, 12 = 8 วัน
    expect(summarizeMonthToDate(base)).toMatchObject({ total: 9, notCheckedIn: 8, onTime: 0 });
  });

  it("should count today's check-in but not today's missing one", () => {
    const summary = summarizeMonthToDate({ ...base, records: [record(13, "08:10")] });
    expect(summary).toMatchObject({ onTime: 1, notCheckedIn: 8 });
  });

  it("should count on time, late and outside area days", () => {
    const summary = summarizeMonthToDate({
      ...base,
      records: [record(1, "08:20"), record(2, "09:00", FAR), record(5, "08:00", { work_type: "wfh", ...FAR })],
    });
    expect(summary).toMatchObject({ onTime: 2, late: 1, outsideArea: 1, notCheckedIn: 5 });
  });

  it("should count leave days and full-day plan exceptions as leave", () => {
    const summary = summarizeMonthToDate({
      ...base,
      leaves: [{ start_date: day(5, "00:00"), end_date: day(7, "00:00") }],
      exceptions: [
        { date: day(8), period: "full", type: "leave" },
        { date: day(9), period: "morning", type: "leave" },
        { date: day(12), period: "full", type: "official_trip" },
      ],
    });
    expect(summary).toMatchObject({ onLeave: 4, officialTrip: 1, notCheckedIn: 3 });
  });

  it("should skip public holidays", () => {
    const summary = summarizeMonthToDate({ ...base, isHolidayDate: (date: Date) => date.getDate() === 12 });
    expect(summary).toMatchObject({ total: 8, notCheckedIn: 7 });
  });
});
