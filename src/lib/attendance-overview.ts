import { getLateThreshold, mergeApprovedPeriods, type DayPeriod } from "./attendance-exception";

export type TodayOverviewRecord = {
  user_id: number;
  work_type: string;
  check_in_time: Date | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
};

export type TodayOverviewInput = {
  /** ผู้ใช้ในขอบเขตที่มองเห็น (ทั้งหน่วยงาน หรือเฉพาะกลุ่มงานของหัวหน้า) */
  userIds: readonly number[];
  records: readonly TodayOverviewRecord[];
  /** ผู้ที่มีใบลาอนุมัติแล้วครอบคลุมวันนี้ */
  onLeaveUserIds: readonly number[];
  /** ลา/ไปราชการจากแผนงานที่อนุมัติแล้วของวันนี้ */
  exceptions: readonly { user_id: number; period: DayPeriod }[];
  date: Date;
  workingTime: string;
  afternoonStart: string;
  isHoliday: boolean;
  office: { lat: number; lng: number; radius: number };
};

export type TodayOverview = {
  total: number;
  notCheckedIn: number;
  onTime: number;
  late: number;
  /** ลงเวลาแบบเข้าสำนักงานแต่อยู่นอกรัศมี (นับซ้อนกับทันเวลา/มาสาย) */
  outsideArea: number;
  onLeave: number;
};

/** ระยะห่างระหว่างสองพิกัด (เมตร) ตามสูตร Haversine */
export const distanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * ภาพรวมการลงเวลาวันนี้: แต่ละคนอยู่ในกลุ่มเดียวจาก ทันเวลา / มาสาย / ลางาน / ยังไม่ลงเวลา
 * เกณฑ์สายเหมือนรายงาน (Onsite และวันหยุดไม่นับสาย, ได้รับอนุมัติครึ่งเช้าเลื่อนไปช่วงบ่าย)
 */
export const summarizeTodayAttendance = (input: TodayOverviewInput): TodayOverview => {
  const recordByUser = new Map(input.records.map((record) => [record.user_id, record]));
  const onLeave = new Set(input.onLeaveUserIds);
  const periodsByUser = new Map<number, DayPeriod[]>();
  for (const exception of input.exceptions) {
    periodsByUser.set(exception.user_id, [...(periodsByUser.get(exception.user_id) ?? []), exception.period]);
  }

  const summary: TodayOverview = { total: input.userIds.length, notCheckedIn: 0, onTime: 0, late: 0, outsideArea: 0, onLeave: 0 };

  for (const userId of input.userIds) {
    const period = mergeApprovedPeriods(periodsByUser.get(userId) ?? []);
    const record = recordByUser.get(userId);

    if (record?.check_in_time) {
      const threshold = getLateThreshold(input.date, input.workingTime, input.afternoonStart, period);
      const isLate = record.work_type !== "onsite" && !input.isHoliday && record.check_in_time > threshold;
      summary[isLate ? "late" : "onTime"] += 1;

      if (
        record.work_type === "office" &&
        record.check_in_lat != null &&
        record.check_in_lng != null &&
        distanceInMeters(record.check_in_lat, record.check_in_lng, input.office.lat, input.office.lng) > input.office.radius
      ) {
        summary.outsideArea += 1;
      }
    } else if (onLeave.has(userId) || period === "full") {
      summary.onLeave += 1;
    } else {
      summary.notCheckedIn += 1;
    }
  }

  return summary;
};

export type MonthToDateInput = {
  today: Date;
  /** การลงเวลาของผู้ใช้คนนี้ในเดือนนี้ */
  records: readonly TodayOverviewRecord[];
  /** ใบลาที่อนุมัติแล้วที่คาบเกี่ยวเดือนนี้ */
  leaves: readonly { start_date: Date; end_date: Date }[];
  /** ลา/ไปราชการจากแผนงานที่อนุมัติแล้วในเดือนนี้ */
  exceptions: readonly { date: Date; period: DayPeriod }[];
  isHolidayDate: (date: Date) => boolean;
  workingTime: string;
  afternoonStart: string;
  office: TodayOverviewInput["office"];
};

const dayKey = (date: Date) => date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

/**
 * สรุปการลงเวลาของผู้ใช้คนเดียวตั้งแต่ต้นเดือนถึงวันนี้ (หน่วย: วันทำการ)
 * ใช้เกณฑ์เดียวกับภาพรวมวันนี้ทีละวัน ส่วน "ยังไม่ลงเวลา" ของวันนี้ไม่นับ เพราะวันยังไม่จบ
 */
export const summarizeMonthToDate = (input: MonthToDateInput): TodayOverview => {
  const summary: TodayOverview = { total: 0, notCheckedIn: 0, onTime: 0, late: 0, outsideArea: 0, onLeave: 0 };
  const todayKey = dayKey(input.today);

  for (let date = 1; date <= input.today.getDate(); date++) {
    const day = new Date(input.today.getFullYear(), input.today.getMonth(), date, 12);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6 || input.isHolidayDate(day)) continue;

    const key = dayKey(day);
    const daySummary = summarizeTodayAttendance({
      userIds: [0],
      records: input.records.filter((record) => record.check_in_time && dayKey(record.check_in_time) === key).map((record) => ({ ...record, user_id: 0 })),
      onLeaveUserIds: input.leaves.some((leave) => dayKey(leave.start_date) <= key && key <= dayKey(leave.end_date)) ? [0] : [],
      exceptions: input.exceptions.filter((exception) => dayKey(exception.date) === key).map((exception) => ({ user_id: 0, period: exception.period })),
      date: day,
      workingTime: input.workingTime,
      afternoonStart: input.afternoonStart,
      isHoliday: false,
      office: input.office,
    });

    summary.total += 1;
    if (key !== todayKey) summary.notCheckedIn += daySummary.notCheckedIn;
    summary.onTime += daySummary.onTime;
    summary.late += daySummary.late;
    summary.outsideArea += daySummary.outsideArea;
    summary.onLeave += daySummary.onLeave;
  }

  return summary;
};
