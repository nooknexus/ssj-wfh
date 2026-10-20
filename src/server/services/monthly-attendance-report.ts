import type { PrismaClient } from "@prisma/client";
import { DEFAULT_AFTERNOON_START } from "@/lib/attendance-exception";
import {
  buildMonthlyReportRow,
  countPersonnelTypes,
  formatThaiMonth,
  type MonthlyReportRow,
} from "@/lib/attendance-report";
import { getThaiHolidaysForRange, isHoliday } from "../utils/holidays";
import { fetchPersonnelTypes } from "./personnel-type";

export type MonthlyAttendanceReport = {
  departmentName: string;
  monthLabel: string;
  rows: Array<MonthlyReportRow & { userId: number; name: string; personnelType: string | null }>;
  personnel: ReturnType<typeof countPersonnelTypes> & { available: boolean };
};

const settingValue = async (db: PrismaClient, key: string, fallback: string) =>
  (await db.systemSetting.findUnique({ where: { setting_key: key } }))?.setting_value || fallback;

/** รวมข้อมูลของทั้งกลุ่มงานในเดือนที่เลือก แล้วสร้างแถวตามแบบรายงานการลงเวลาปฏิบัติราชการ */
export const buildMonthlyAttendanceReport = async (
  db: PrismaClient,
  params: { year: number; month: number; departmentId: number },
): Promise<MonthlyAttendanceReport> => {
  const monthStart = new Date(params.year, params.month - 1, 1);
  const monthEnd = new Date(params.year, params.month, 0, 23, 59, 59, 999);
  const userWhere = { department_id: params.departmentId };

  const [department, users, attendance, leaves, exceptions, holidays, workingTime, afternoonStart] = await Promise.all([
    db.department.findUnique({ where: { id: params.departmentId }, select: { name: true } }),
    db.user.findMany({
      where: { ...userWhere, status: "active" },
      select: { id: true, name_th: true, name_eng: true, title_th: true, username: true },
      orderBy: { name_th: "asc" },
    }),
    db.attendanceRecord.findMany({
      where: { date: { gte: monthStart, lte: monthEnd }, user: userWhere },
      select: { user_id: true, date: true, check_in_time: true, check_out_time: true, work_type: true },
    }),
    db.leaveRequest.findMany({
      where: { step2_status: "approved", start_date: { lte: monthEnd }, end_date: { gte: monthStart }, user: userWhere },
      select: { user_id: true, start_date: true, end_date: true, total_days: true, leave_type: { select: { name: true } } },
    }),
    db.attendanceException.findMany({
      where: { status: "approved", date: { gte: monthStart, lte: monthEnd }, user: userWhere },
      select: { user_id: true, date: true, type: true, period: true },
    }),
    getThaiHolidaysForRange(monthStart, monthEnd),
    settingValue(db, "working_time", "08:30"),
    settingValue(db, "afternoon_start_time", DEFAULT_AFTERNOON_START),
  ]);

  const personnel = await fetchPersonnelTypes(users.map((user) => user.username ?? ""));
  const typeOf = (cid: string | null) => (personnel.available && cid ? personnel.typeByCid.get(cid) ?? null : null);
  const today = new Date();

  const rows = users.map((user) => ({
    userId: user.id,
    name: [user.title_th, user.name_th ?? user.name_eng].filter(Boolean).join("") || `#${user.id}`,
    personnelType: typeOf(user.username),
    ...buildMonthlyReportRow({
      year: params.year,
      month: params.month,
      today,
      isHolidayDate: (date) => isHoliday(date, holidays),
      workingTime,
      afternoonStart,
      attendance: attendance.filter((record) => record.user_id === user.id),
      leaves: leaves
        .filter((leave) => leave.user_id === user.id)
        .map((leave) => ({ ...leave, total_days: Number(leave.total_days), leaveTypeName: leave.leave_type.name })),
      exceptions: exceptions.filter((exception) => exception.user_id === user.id),
    }),
  }));

  return {
    departmentName: department?.name ?? "-",
    monthLabel: formatThaiMonth(params.year, params.month),
    rows,
    personnel: { ...countPersonnelTypes(rows.map((row) => row.personnelType)), available: personnel.available },
  };
};
