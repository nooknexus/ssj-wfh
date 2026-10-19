import { z } from "zod";
import { HR_ROLES, canApproveWfhRequest, hasAnyRole, hasRole } from "@/lib/roles";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const wfhRouter = createTRPCRouter({
  // Get all WFH requests for the current user
  getUserRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.wfhRequest.findMany({
      where: {
        user_id: parseInt((ctx.session.user as any).id),
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }),

  // Get all WFH requests (Admin) with pagination and search
  getAllRequests: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const searchPattern = input.search ? `%${input.search}%` : null;
      
      const items = await ctx.db.$queryRawUnsafe<any[]>(`
        SELECT 
          w.*, 
          u.name_th as user_name_th,
          u.position as user_position
        FROM wfh_requests w
        LEFT JOIN users u ON w.user_id = u.id
        WHERE 1=1
        ${input.search ? `AND u.name_th LIKE ?` : ""}
        ORDER BY 
          CASE WHEN w.status = 'pending' THEN 0 ELSE 1 END ASC,
          w.start_date DESC
        LIMIT ? OFFSET ?
      `, ...(input.search ? [searchPattern] : []), input.limit, skip);

      const countResult = await ctx.db.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*) as total
        FROM wfh_requests w
        LEFT JOIN users u ON w.user_id = u.id
        WHERE 1=1
        ${input.search ? `AND u.name_th LIKE ?` : ""}
      `, ...(input.search ? [searchPattern] : []));

      const total = Number(countResult[0].total);

      const mappedItems = items.map(item => ({
        ...item,
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

  // Get all pending WFH requests for Admin/Manager approval
  getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.wfhRequest.findMany({
      where: {
        status: "pending",
      },
      include: {
        user: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }),

  // Create a new WFH request
  create: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = parseInt((ctx.session.user as any).id);
      const currentUser = await ctx.db.user.findUnique({
        where: { id: currentUserId },
        select: { department_id: true, roles: { select: { role: true } } }
      });

      // ต้องมีกลุ่มงานก่อนจึงส่งคำขอได้ เพราะหัวหน้ากลุ่มงานเป็นผู้อนุมัติ
      if (currentUser?.department_id == null) {
        throw new Error("ยังไม่ได้กำหนดกลุ่มงาน กรุณาติดต่อผู้ดูแลระบบก่อนส่งคำขอ WFH");
      }

      const isLeader = hasRole(currentUser?.roles.map((item) => item.role), "leader");

      return ctx.db.wfhRequest.create({
        data: {
          user_id: currentUserId,
          start_date: input.startDate,
          end_date: input.endDate,
          reason: input.reason,
          status: isLeader ? "approved" : "pending",
          ...(isLeader ? {
            approved_by: currentUserId,
            approved_at: new Date()
          } : {})
        },
      });
    }),

  // Get department requests for leader approval
  getDepartmentRequests: protectedProcedure.query(async ({ ctx }) => {
    const currentUserId = parseInt((ctx.session.user as any).id);
    const currentUser = await ctx.db.user.findUnique({
      where: { id: currentUserId },
      select: { department_id: true, roles: { select: { role: true } } }
    });
    const roles = currentUser?.roles.map((item) => item.role);

    // hradmin/superadmin เห็นทุกกลุ่มงาน หัวหน้างานเห็นเฉพาะกลุ่มงานของตัวเอง
    const seesAllDepartments = hasAnyRole(roles, HR_ROLES);
    const isDepartmentLeader = hasRole(roles, "leader") && Boolean(currentUser?.department_id);
    if (!currentUser || (!seesAllDepartments && !isDepartmentLeader)) {
      return [];
    }

    const requests = await ctx.db.wfhRequest.findMany({
      where: seesAllDepartments
        ? undefined
        : { user: { department_id: currentUser.department_id } },
      include: {
        user: true,
      },
      orderBy: {
        created_at: "desc"
      },
    });

    const withPermission = requests.map((request) => ({
      ...request,
      canApprove: canApproveWfhRequest({
        approverRoles: roles ?? [],
        approverDepartmentId: currentUser.department_id,
        requesterDepartmentId: request.user.department_id,
      }),
    }));

    return withPermission.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return 0;
    });
  }),

  // Update status (Approve/Reject)
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        rejectReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = parseInt((ctx.session.user as any).id);
      const currentUser = await ctx.db.user.findUnique({
        where: { id: currentUserId },
        select: { department_id: true, roles: { select: { role: true } } }
      });
      const roles = currentUser?.roles.map((item) => item.role);

      if (!currentUser || !hasRole(roles, "leader")) {
        throw new Error("ไม่มีสิทธิ์ในการอนุมัติ");
      }

      const request = await ctx.db.wfhRequest.findUnique({
        where: { id: input.id },
        include: { user: true }
      });

      if (!request) {
        throw new Error("ไม่พบคำขอ");
      }

      // เฉพาะหัวหน้ากลุ่มงานของผู้ขอเท่านั้นที่อนุมัติได้ (hradmin/superadmin ดูได้อย่างเดียว)
      const allowed = canApproveWfhRequest({
        approverRoles: roles ?? [],
        approverDepartmentId: currentUser.department_id,
        requesterDepartmentId: request.user.department_id,
      });
      if (!allowed) {
        throw new Error("อนุมัติได้เฉพาะคำขอของกลุ่มงานที่ท่านเป็นหัวหน้าเท่านั้น");
      }

      return ctx.db.wfhRequest.update({
        where: { id: input.id },
        data: { 
          status: input.status,
          approved_by: currentUserId,
          approved_at: new Date(),
          reject_reason: input.rejectReason,
        },
      });
    }),
});
