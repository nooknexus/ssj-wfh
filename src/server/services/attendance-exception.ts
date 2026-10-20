import { endOfDay, startOfDay } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import type { DayPeriod } from "@/lib/attendance-exception";

type Db = Pick<PrismaClient, "attendanceException">;

/** ช่วงเวลาของข้อยกเว้นที่อนุมัติแล้วของผู้ใช้ในวันนั้น ถ้ามีครึ่งเช้าและครึ่งบ่ายครบ ถือเป็นเต็มวัน */
export const findApprovedPeriodForDay = async (
  db: Db,
  userId: number,
  date: Date,
): Promise<DayPeriod | null> => {
  const items = await db.attendanceException.findMany({
    where: {
      user_id: userId,
      status: "approved",
      date: { gte: startOfDay(date), lte: endOfDay(date) },
    },
    select: { period: true },
  });
  const periods = new Set(items.map((item) => item.period));
  if (periods.has("full") || (periods.has("morning") && periods.has("afternoon"))) return "full";
  return periods.values().next().value ?? null;
};
