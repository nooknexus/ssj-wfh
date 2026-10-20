/**
 * แปลงแถวใบลาจาก MySQL ของระบบลา (ต้นทาง) ให้อยู่ในรูปที่บันทึกลง leave_requests ของระบบนี้ได้
 * ไม่มีการเชื่อมต่อฐานข้อมูลในไฟล์นี้ เพื่อให้ทดสอบได้ด้วย unit test
 */

export const LEAVE_SOURCE = "leave_mysql";

export type LeaveStatusValue = "pending" | "step1_approved" | "approved" | "rejected" | "cancelled";

const LEAVE_STATUSES: LeaveStatusValue[] = ["pending", "step1_approved", "approved", "rejected", "cancelled"];

/** ประเภทที่ไม่ใช่การลา จึงไม่นำเข้า */
const EXCLUDED_TYPE_KEYWORDS = ["WFH", "ปฏิบัติงานที่บ้าน"];

export type RemoteLeaveRow = {
  id: number | string;
  cid: string | null;
  external_name: string | null;
  leave_type_name: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  total_days: number | string | null;
  reason: string | null;
  status: string | null;
  step1_status: string | null;
  step2_status: string | null;
};

export type LeaveRecordInput = {
  sourceRecordId: string;
  cid: string | null;
  fullName: string | null;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string | null;
  status: LeaveStatusValue;
  step1Status: LeaveStatusValue;
  step2Status: LeaveStatusValue;
};

export type TransformResult = { ok: true; data: LeaveRecordInput } | { ok: false; reason: string };

/** เก็บเฉพาะตัวเลข และต้องครบ 13 หลัก */
export const normalizeCid = (raw: string | null | undefined): string | null => {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  return digits.length === 13 ? digits : null;
};

export const mapLeaveStatus = (raw: string | null | undefined): LeaveStatusValue => {
  const value = (raw ?? "").trim() as LeaveStatusValue;
  return LEAVE_STATUSES.includes(value) ? value : "pending";
};

export const isExcludedLeaveType = (name: string | null | undefined): boolean =>
  EXCLUDED_TYPE_KEYWORDS.some((keyword) => (name ?? "").includes(keyword));

/** แปลงวันที่ (YYYY-MM-DD หรือ Date) เป็นเที่ยงคืน UTC เพื่อไม่ให้วันเลื่อนเมื่อบันทึกลงคอลัมน์ DATE */
export const toUtcDateOnly = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDate() === day ? date : null;
};

const cleanText = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : null;
};

export const transformRemoteLeave = (row: RemoteLeaveRow): TransformResult => {
  const leaveTypeName = cleanText(row.leave_type_name) ?? "อื่นๆ";
  if (isExcludedLeaveType(leaveTypeName)) return { ok: false, reason: "excluded_type" };

  const cid = normalizeCid(row.cid);
  const fullName = cleanText(row.external_name);
  if (!cid && !fullName) return { ok: false, reason: "no_identity" };

  const startDate = toUtcDateOnly(row.start_date);
  const endDate = toUtcDateOnly(row.end_date) ?? startDate;
  if (!startDate || !endDate || endDate < startDate) return { ok: false, reason: "invalid_date" };

  const totalDays = Number(row.total_days);
  const status = mapLeaveStatus(row.status);
  // ใบลาที่ยกเลิกแล้ว ต้องไม่ถูกนับเป็นวันลา (รายงานลงเวลานับจาก step2_status = approved)
  const isCancelled = status === "cancelled";
  return {
    ok: true,
    data: {
      sourceRecordId: String(row.id),
      cid,
      fullName,
      leaveTypeName,
      startDate,
      endDate,
      totalDays: Number.isFinite(totalDays) && totalDays > 0 ? totalDays : 1,
      reason: cleanText(row.reason),
      status,
      step1Status: isCancelled ? "cancelled" : mapLeaveStatus(row.step1_status),
      step2Status: isCancelled ? "cancelled" : mapLeaveStatus(row.step2_status),
    },
  };
};

/** ชื่อผู้ลาภายนอก: ถ้าจับคู่ผู้ใช้ได้ไม่ต้องเก็บ ถ้าต้นทางไม่มีชื่อให้คงชื่อเดิมไว้ */
export const pickExternalName = (
  userMatched: boolean,
  sourceName: string | null,
  existingName: string | null | undefined,
): string | null => (userMatched ? null : sourceName ?? existingName ?? null);

/** ชื่อตาราง/คอลัมน์ที่มาจาก .env ต้องเป็นตัวอักษร ตัวเลข หรือ _ เท่านั้น (กัน SQL injection) */
export const assertSqlIdentifier = (value: string, label: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value)) {
    throw new Error(`ค่า ${label} ไม่ถูกต้อง: ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ _`);
  }
  return value;
};
