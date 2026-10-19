import { createTRPCRouter, protectedProcedure, roleProcedure } from "../trpc";
import { USER_MANAGER_ROLES } from "@/lib/roles";
import { z } from "zod";

export const departmentRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const departments = await ctx.db.department.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });
    
    return departments.map(d => ({
      ...d,
      _count: {
        users: Number(d._count?.users || 0)
      }
    }));
  }),

  create: roleProcedure(USER_MANAGER_ROLES)
    .input(
      z.object({
        name: z.string().min(1, "กรุณากรอกชื่อกลุ่มงาน"),
        code: z.string().optional(),
        is_active: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.department.create({
        data: input,
      });
    }),

  update: roleProcedure(USER_MANAGER_ROLES)
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1, "กรุณากรอกชื่อกลุ่มงาน"),
        code: z.string().optional(),
        is_active: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.department.update({
        where: { id },
        data,
      });
    }),

  delete: roleProcedure(USER_MANAGER_ROLES)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.department.delete({
        where: { id: input.id },
      });
    }),
});
