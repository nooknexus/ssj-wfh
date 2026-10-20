import { endOfDay, startOfDay } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { mergeApprovedPeriods, type DayPeriod, type ExceptionType } from "@/lib/attendance-exception";

type Db = Pick<PrismaClient, "attendanceException">;

export type ApprovedDayException = {
  period: DayPeriod;
  types: ExceptionType[];
};

/** ข้อยกเว้นที่อนุมัติแล้วของผู้ใช้ในวันนั้น (รวมครึ่งเช้า + ครึ่งบ่ายเป็นเต็มวัน) */
export const findApprovedExceptionForDay = async (
  db: Db,
  userId: number,
  date: Date,
): Promise<ApprovedDayException | null> => {
  const items = await db.attendanceException.findMany({
    where: {
      user_id: userId,
      status: "approved",
      date: { gte: startOfDay(date), lte: endOfDay(date) },
    },
    select: { period: true, type: true },
  });
  const period = mergeApprovedPeriods(items.map((item) => item.period));
  return period ? { period, types: [...new Set(items.map((item) => item.type))] } : null;
};
