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

    // 2. Leave Quota (Vacation - id: 1 assumed or find by code 'vacation')
    const vacationQuota = await ctx.db.leaveQuota.findFirst({
      where: {
        user_id: userId,
        leave_type: {
          code: "vacation",
        },
      },
    });

    // 3. Today Meetings
    const todayMeetings = await ctx.db.meetingBooking.count({
      where: {
        date: {
          gte: start,
          lte: end,
        },
        status: "approved",
        OR: [
          { user_id: userId },
          { attendees: { gt: 0 } }, // Simplification for demo
        ],
      },
    });

    // 4. Pending Tasks
    // - Leave requests waiting for this user if they are approver
    // - Documents assigned to this user
    const pendingLeaves = await ctx.db.leaveRequest.count({
      where: {
        OR: [
          { step1_by: userId, step1_status: "pending" },
          { step2_by: userId, step2_status: "pending" },
        ],
      },
    });

    const pendingDocs = await ctx.db.document.count({
      where: {
        assigned_to: userId,
        status: { in: ["new", "pending", "in_progress"] },
      },
    });

    return {
      attendance: todayAttendance,
      vacationDaysLeft: vacationQuota ? Number(vacationQuota.total_days) - Number(vacationQuota.used_days) : 0,
      todayMeetings,
      pendingTasks: pendingLeaves + pendingDocs,
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

    const recentBookings = await ctx.db.meetingBooking.findMany({
      where: { user_id: userId },
      include: { room: true },
      orderBy: { date: "desc" },
      take: 3,
    });

    const recentDocs = await ctx.db.document.findMany({
      where: { assigned_to: userId },
      orderBy: { created_at: "desc" },
      take: 3,
    });

    return {
      attendance: recentAttendance,
      leaves: recentLeaves,
      bookings: recentBookings,
      documents: recentDocs,
    };
  }),
});
