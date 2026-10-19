import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, roleProcedure } from "../trpc";
import { ASSIGNABLE_ROLES, USER_MANAGER_ROLES, validateRoleChange } from "@/lib/roles";

export const userRouter = createTRPCRouter({
  // รายชื่อผู้ใช้แบบเต็ม (รวม email/roles) สำหรับหน้าจัดการผู้ใช้งาน
  getAll: roleProcedure(USER_MANAGER_ROLES)
    .input(
      z.object({
        search: z.string().trim().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim();

      return ctx.db.user.findMany({
        where: {
          OR: search
            ? [
                { name_th: { contains: search } },
                { name_eng: { contains: search } },
                { position: { contains: search } },
                { hname: { contains: search } },
                { username: { contains: search } },
              ]
            : undefined,
        },
        select: {
          id: true,
          username: true,
          name_th: true,
          name_eng: true,
          title_th: true,
          position: true,
          hname: true,
          email: true,
          status: true,
          roles: { select: { role: true } },
          department_id: true,
          created_at: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { status: "asc" },
          { created_at: "desc" },
        ],
      });
    }),
  // รายชื่อผู้ใช้สำหรับ dropdown มอบหมายงาน คืนเฉพาะข้อมูลที่ใช้แสดงผล
  listAssignable: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: {
        id: true,
        title_th: true,
        name_th: true,
        name_eng: true,
        position: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { name_th: "asc" },
    });
  }),
  updateStatus: roleProcedure(USER_MANAGER_ROLES)
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["active", "inactive", "pending"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.id },
        data: {
          status: input.status,
        },
      });
    }),
  updateDepartment: roleProcedure(USER_MANAGER_ROLES)
    .input(
      z.object({
        userId: z.number(),
        departmentId: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.userId },
        data: {
          department_id: input.departmentId,
        },
      });
    }),
  setRoles: roleProcedure(USER_MANAGER_ROLES)
    .input(
      z.object({
        userId: z.number(),
        roles: z.array(z.enum(ASSIGNABLE_ROLES)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextRoles = [...new Set(input.roles)];
      const [currentRoles, superadminCount] = await Promise.all([
        ctx.db.userRole.findMany({ where: { user_id: input.userId }, select: { role: true } }),
        ctx.db.userRole.count({ where: { role: "superadmin" } }),
      ]);

      const error = validateRoleChange({
        actorRoles: ctx.session.user.roles,
        targetCurrentRoles: currentRoles.map((item) => item.role),
        nextRoles,
        superadminCount,
      });
      if (error) {
        throw new TRPCError({ code: "FORBIDDEN", message: error });
      }

      await ctx.db.$transaction([
        ctx.db.userRole.deleteMany({ where: { user_id: input.userId } }),
        ctx.db.userRole.createMany({
          data: nextRoles.map((role) => ({ user_id: input.userId, role })),
        }),
      ]);
      return { roles: nextRoles };
    }),
});
