import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { addDays, endOfDay, startOfDay, startOfWeek } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { findApprovedExceptionForDay } from "../services/attendance-exception";
import { HR_ROLES, canApproveDepartmentLeaderRequest, hasAnyRole, hasRole } from "@/lib/roles";
import {
  ACTIVE_EXCEPTION_STATUSES,
  DAY_PERIODS,
  EXCEPTION_TYPES,
  normalizeToNoon,
  periodsConflict,
  validateExceptionDate,
} from "@/lib/attendance-exception";

const UPLOAD_PREFIX = "/uploads/documents/";

const createInput = z.object({
  date: z.date(),
  type: z.enum(EXCEPTION_TYPES),
  period: z.enum(DAY_PERIODS),
  reason: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(255).optional(),
  attachmentUrl: z.string().startsWith(UPLOAD_PREFIX).max(500).optional(),
});

const fail = (message: string, code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" = "BAD_REQUEST") =>
  new TRPCError({ code, message });

export const attendanceExceptionRouter = createTRPCRouter({
  // ข้อยกเว้นที่อนุมัติแล้วของวันนี้ สำหรับการ์ดลงเวลา
  getTodayApproved: protectedProcedure.query(({ ctx }) =>
    findApprovedExceptionForDay(ctx.db, Number(ctx.session.user.id), new Date()),
  ),

  // รายการของตัวเองในสัปดาห์ที่เลือก (อาทิตย์–เสาร์) สำหรับหน้าแผนงาน
  listMine: protectedProcedure
    .input(z.object({ weekDate: z.date() }))
    .query(async ({ ctx, input }) => {
      const weekStart = startOfWeek(normalizeToNoon(input.weekDate), { weekStartsOn: 0 });
      return ctx.db.attendanceException.findMany({
        where: {
          user_id: Number(ctx.session.user.id),
          date: { gte: startOfDay(weekStart), lte: endOfDay(addDays(weekStart, 6)) },
          status: { not: "cancelled" },
        },
        orderBy: [{ date: "asc" }, { created_at: "asc" }],
      });
    }),

  create: protectedProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const userId = Number(ctx.session.user.id);
    const date = normalizeToNoon(input.date);
    const dateError = validateExceptionDate(date, new Date());
    if (dateError) throw fail(dateError);

    const currentUser = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { department_id: true, roles: { select: { role: true } } },
    });
    // หัวหน้ากลุ่มงานเป็นผู้อนุมัติ จึงต้องมีกลุ่มงานก่อน
    if (currentUser?.department_id == null) {
      throw fail("ยังไม่ได้กำหนดกลุ่มงาน กรุณาติดต่อผู้ดูแลระบบก่อนแจ้งลาหรือไปราชการ");
    }

    const sameDay = await ctx.db.attendanceException.findMany({
      where: {
        user_id: userId,
        date: { gte: startOfDay(date), lte: endOfDay(date) },
        status: { in: ACTIVE_EXCEPTION_STATUSES },
      },
      select: { period: true },
    });
    if (sameDay.some((item) => periodsConflict(item.period, input.period))) {
      throw fail("วันนี้มีการแจ้งลาหรือไปราชการในช่วงเวลาเดียวกันแล้ว");
    }

    // หัวหน้างานยื่นของตัวเองแล้วอนุมัติอัตโนมัติ เหมือนคำขอ WFH
    const isLeader = hasRole(currentUser.roles.map((item) => item.role), "leader");
    return ctx.db.attendanceException.create({
      data: {
        user_id: userId,
        date,
        type: input.type,
        period: input.period,
        reason: input.reason || null,
        location: input.type === "official_trip" ? input.location || null : null,
        attachment_url: input.type === "official_trip" ? input.attachmentUrl ?? null : null,
        status: isLeader ? "approved" : "pending",
        ...(isLeader ? { approved_by: userId, approved_at: new Date() } : {}),
      },
    });
  }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.attendanceException.findUnique({ where: { id: input.id } });
      if (!item || item.user_id !== Number(ctx.session.user.id)) throw fail("ไม่พบรายการ", "NOT_FOUND");
      if (!ACTIVE_EXCEPTION_STATUSES.includes(item.status)) throw fail("รายการนี้ยกเลิกไม่ได้");
      if (validateExceptionDate(normalizeToNoon(item.date), new Date())) {
        throw fail("ไม่สามารถยกเลิกรายการของวันที่ผ่านไปแล้ว");
      }
      return ctx.db.attendanceException.update({
        where: { id: input.id },
        data: { status: "cancelled" },
      });
    }),

  // รายการสำหรับหน้าอนุมัติ: hradmin/superadmin เห็นทุกกลุ่มงาน หัวหน้างานเห็นเฉพาะกลุ่มงานตัวเอง
  getDepartmentRequests: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = await ctx.db.user.findUnique({
      where: { id: Number(ctx.session.user.id) },
      select: { department_id: true, roles: { select: { role: true } } },
    });
    const roles = currentUser?.roles.map((item) => item.role) ?? [];
    const seesAll = hasAnyRole(roles, HR_ROLES);
    const isDepartmentLeader = hasRole(roles, "leader") && currentUser?.department_id != null;
    if (!currentUser || (!seesAll && !isDepartmentLeader)) return [];

    const requests = await ctx.db.attendanceException.findMany({
      where: {
        status: { not: "cancelled" },
        ...(seesAll ? {} : { user: { department_id: currentUser.department_id } }),
      },
      include: { user: { select: { id: true, name_th: true, position: true, department_id: true } } },
      orderBy: [{ date: "desc" }],
      take: 500,
    });

    return requests
      .map((request) => ({
        ...request,
        canApprove: canApproveDepartmentLeaderRequest({
          approverRoles: roles,
          approverDepartmentId: currentUser.department_id,
          requesterDepartmentId: request.user.department_id,
        }),
      }))
      .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        rejectReason: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const approverId = Number(ctx.session.user.id);
      const [approver, request] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: approverId },
          select: { department_id: true, roles: { select: { role: true } } },
        }),
        ctx.db.attendanceException.findUnique({
          where: { id: input.id },
          include: { user: { select: { department_id: true } } },
        }),
      ]);
      if (!request) throw fail("ไม่พบคำขอ", "NOT_FOUND");
      if (request.status !== "pending") throw fail("คำขอนี้ได้รับการพิจารณาแล้ว");

      const allowed = canApproveDepartmentLeaderRequest({
        approverRoles: approver?.roles.map((item) => item.role) ?? [],
        approverDepartmentId: approver?.department_id,
        requesterDepartmentId: request.user.department_id,
      });
      if (!allowed) throw fail("อนุมัติได้เฉพาะคำขอของกลุ่มงานที่ท่านเป็นหัวหน้าเท่านั้น", "FORBIDDEN");

      return ctx.db.attendanceException.update({
        where: { id: input.id },
        data: {
          status: input.status,
          approved_by: approverId,
          approved_at: new Date(),
          reject_reason: input.status === "rejected" ? input.rejectReason || null : null,
        },
      });
    }),
});
