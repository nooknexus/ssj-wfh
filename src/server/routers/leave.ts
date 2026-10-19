import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, roleProcedure } from "../trpc";
import { canApproveDepartmentRequest, hasAnyRole, HR_ROLES, WFH_APPROVER_ROLES } from "@/lib/roles";
import { syncLeavesFromGoogleSheet } from "../services/leave-sync";

export const leaveRouter = createTRPCRouter({
  syncFromGoogleSheet: roleProcedure(HR_ROLES).mutation(async () => {
    return syncLeavesFromGoogleSheet();
  }),
  // Get all leaves for the current user
  getUserLeaves: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.leaveRequest.findMany({
      where: {
        user_id: parseInt((ctx.session.user as any).id),
      },
      include: {
        leave_type: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }),

  // Get all leave types
  getLeaveTypes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.leaveType.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
    });
  }),

  // Get all leaves (Admin) with pagination and search
  getAllLeaves: roleProcedure(HR_ROLES)
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const where = input.search
        ? {
            OR: [
              { user: { name_th: { contains: input.search } } },
              { external_name: { contains: input.search } },
              { cid: { contains: input.search } },
            ],
          }
        : {};

      // Note: Custom sorting (pending first) is tricky in Prisma findMany.
      // We'll sort by status (desc) and start_date (desc) as a fallback,
      // or we can use a more advanced approach.
      // Since 'rejected' > 'pending' > 'approved' alphabetically (r > p > a),
      // sorting status desc will put rejected first, then pending.
      // To get pending first, we'd ideally need a raw query.
      // Let's use a raw query for the exact sorting requirement.
      
      const searchPattern = input.search ? `%${input.search}%` : null;
      
      // We'll fetch the IDs first to keep it simple and then fetch full objects
      // OR just fetch everything in raw. Let's do raw for efficiency.
      const items = await ctx.db.$queryRawUnsafe<any[]>(`
        SELECT 
          lr.*, 
          lt.name as leave_type_name,
          u.name_th as user_name_th,
          u.position as user_position
        FROM leave_requests lr
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN users u ON lr.user_id = u.id
        WHERE 1=1
        ${input.search ? `AND (u.name_th LIKE ? OR lr.external_name LIKE ? OR lr.cid LIKE ?)` : ""}
        ORDER BY 
          CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END ASC,
          lr.start_date DESC
        LIMIT ? OFFSET ?
      `, ...(input.search ? [searchPattern, searchPattern, searchPattern] : []), input.limit, skip);

      const countResult = await ctx.db.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*) as total
        FROM leave_requests lr
        LEFT JOIN users u ON lr.user_id = u.id
        WHERE 1=1
        ${input.search ? `AND (u.name_th LIKE ? OR lr.external_name LIKE ? OR lr.cid LIKE ?)` : ""}
      `, ...(input.search ? [searchPattern, searchPattern, searchPattern] : []));

      const total = Number(countResult[0].total);

      // Map back to expected structure for UI
      const mappedItems = items.map(item => ({
        ...item,
        leave_type: { name: item.leave_type_name },
        user: item.user_id ? { 
          name_th: item.user_name_th,
          position: item.user_position 
        } : null
      }));

      return {
        items: mappedItems,
        total,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // Get all pending leaves for approval
  // hradmin/superadmin เห็นทุกกลุ่มงาน ส่วน leader เห็นเฉพาะคำขอของผู้ใช้ในกลุ่มงานตัวเอง
  getPendingLeaves: roleProcedure(WFH_APPROVER_ROLES).query(async ({ ctx }) => {
    const roles = ctx.session.user.roles;
    let departmentFilter = {};
    if (!hasAnyRole(roles, HR_ROLES)) {
      const approver = await ctx.db.user.findUnique({
        where: { id: Number(ctx.session.user.id) },
        select: { department_id: true },
      });
      if (approver?.department_id == null) return [];
      departmentFilter = { user: { department_id: approver.department_id } };
    }

    return ctx.db.leaveRequest.findMany({
      where: {
        status: "pending",
        ...departmentFilter,
      },
      include: {
        user: true,
        leave_type: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }),

  // Create a new leave request
  create: protectedProcedure
    .input(
      z.object({
        leaveTypeId: z.number(),
        startDate: z.date(),
        endDate: z.date(),
        days: z.number(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.leaveRequest.create({
        data: {
          user_id: parseInt((ctx.session.user as any).id),
          leave_type_id: input.leaveTypeId,
          start_date: input.startDate,
          end_date: input.endDate,
          total_days: input.days,
          reason: input.reason,
          status: "pending",
        },
      });
    }),

  // Update status (Approve/Reject)
  // hradmin/superadmin ทำได้ทุกกลุ่มงาน ส่วน leader ทำได้เฉพาะคำขอของผู้ใช้ในกลุ่มงานตัวเอง
  updateStatus: roleProcedure(WFH_APPROVER_ROLES)
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [approver, request] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: Number(ctx.session.user.id) },
          select: { department_id: true },
        }),
        ctx.db.leaveRequest.findUnique({
          where: { id: input.id },
          select: { user: { select: { department_id: true } } },
        }),
      ]);

      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบคำขอลา" });
      }

      const allowed = canApproveDepartmentRequest({
        approverRoles: ctx.session.user.roles,
        approverDepartmentId: approver?.department_id,
        requesterDepartmentId: request.user?.department_id,
      });
      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถอนุมัติคำขอลาของกลุ่มงานอื่นได้" });
      }

      return ctx.db.leaveRequest.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
