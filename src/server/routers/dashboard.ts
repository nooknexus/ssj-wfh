import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { startOfDay, endOfDay } from "date-fns";
import { mergeRecentRequests } from "@/lib/recent-requests";

const RECENT_REQUEST_LIMIT = 3;

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

    // คำขอล่าสุดของตัวเอง: แจ้งไปราชการ/แจ้งลาจากแผนงาน และคำขอ WFH
    const [recentExceptions, recentWfh] = await Promise.all([
      ctx.db.attendanceException.findMany({
        where: { user_id: userId },
        select: { id: true, type: true, date: true, period: true, status: true, created_at: true },
        orderBy: { created_at: "desc" },
        take: RECENT_REQUEST_LIMIT,
      }),
      ctx.db.wfhRequest.findMany({
        where: { user_id: userId },
        select: { id: true, start_date: true, end_date: true, status: true, created_at: true },
        orderBy: { created_at: "desc" },
        take: RECENT_REQUEST_LIMIT,
      }),
    ]);

    return {
      attendance: recentAttendance,
      requests: mergeRecentRequests(recentExceptions, recentWfh, RECENT_REQUEST_LIMIT),
    };
  }),
});
