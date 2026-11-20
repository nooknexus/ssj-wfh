import { mergeApprovedPeriods, type DayPeriod } from "./attendance-exception";

type CheckInReminderInput = {
  /** ผู้ใช้ที่เปิดใช้งานอยู่ (username คือเลขบัตรประชาชน 13 หลักที่ MOPH Alert ใช้ส่ง) */
  users: readonly { id: number; username: string | null }[];
  checkedInUserIds: readonly number[];
  /** ผู้ที่มีใบลาอนุมัติแล้วครอบคลุมวันนี้ */
  onLeaveUserIds: readonly number[];
  /** ลา/ไปราชการจากแผนงานที่อนุมัติแล้วของวันนี้ */
  exceptions: readonly { user_id: number; period: DayPeriod }[];
};

/** ข้อยกเว้นที่ครอบคลุมช่วงเช้า (เต็มวันหรือครึ่งเช้า) ไม่ต้องลงเวลาเข้างานตอนเช้า */
const coversMorning = (period: DayPeriod | null) => period === "full" || period === "morning";

/** เลขบัตรของผู้ที่ยังไม่ได้ลงเวลาเข้างานและไม่ได้ลา/ไปราชการช่วงเช้า */
export const selectCheckInReminderCids = (input: CheckInReminderInput): string[] => {
  const checkedIn = new Set(input.checkedInUserIds);
  const onLeave = new Set(input.onLeaveUserIds);
  const periodsByUser = new Map<number, DayPeriod[]>();
  for (const exception of input.exceptions) {
    periodsByUser.set(exception.user_id, [...(periodsByUser.get(exception.user_id) ?? []), exception.period]);
  }

  return input.users
    .filter((user) => !checkedIn.has(user.id) && !onLeave.has(user.id))
    .filter((user) => !coversMorning(mergeApprovedPeriods(periodsByUser.get(user.id) ?? [])))
    .map((user) => user.username)
    .filter((cid): cid is string => Boolean(cid && /^\d{13}$/.test(cid)));
};
