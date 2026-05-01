import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { Role } from "@prisma/client";

export const userRouter = createTRPCRouter({
  getAll: protectedProcedure
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
          role: true,
          status: true,
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
  updateStatus: protectedProcedure
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
  updateDepartment: protectedProcedure
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
  updateRole: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.nativeEnum(Role),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: input.userId },
        data: {
          role: input.role,
        },
      });
    }),
});
