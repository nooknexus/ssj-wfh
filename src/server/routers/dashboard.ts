import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { startOfDay, endOfDay } from "date-fns";

export const dashboardRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);
    if (isNaN(userId)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
    }
    const today = new Date();
    // ปรับให้เป็นเที่ยงวันก่อนหาจุดเริ่ม/สิ้นสุดวัน เพื่อเลี่ยงปัญหา Timezone ขอบวัน
    const normalizedToday = new Date(today);
    normalizedToday.setHours(12, 0, 0, 0);
    
    const start = startOfDay(normalizedToday);
    const end = endOfDay(normalizedToday);

    // 1. Today Attendance
    const todayAttendance = await ctx.db.attendanceRecord.findFirst({
      where: {
        user_id: userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: 'desc'
      }
    });

    return {
      attendance: todayAttendance,
    };
  }),

  getRecentActivities: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);
    if (isNaN(userId)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
    }

    const recentAttendance = await ctx.db.attendanceRecord.findMany({
      where: { user_id: userId },
      orderBy: { date: "desc" },
      take: 3,
    });

    const recentLeaves = await ctx.db.leaveRequest.findMany({
      where: { user_id: userId },
      include: { leave_type: true },
      orderBy: { created_at: "desc" },
      take: 3,
    });

    return {
      attendance: recentAttendance,
      leaves: recentLeaves,
    };
  }),
});
