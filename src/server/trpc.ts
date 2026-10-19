import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "./db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole, normalizeRoles, type AppRole } from "@/lib/roles";

export const createTRPCContext = async (opts: { req?: Request }) => {
  const session = await getServerSession(authOptions);

  return {
    db,
    session,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  
  const userId = Number(ctx.session.user.id);
  if (isNaN(userId)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid user session" });
  }

  return next({
    ctx: {
      session: {
        ...ctx.session,
        user: { ...ctx.session.user, roles: normalizeRoles(ctx.session.user.roles) },
      },
    },
  });
});

/** procedure ที่อนุญาตเฉพาะผู้ใช้ที่มีบทบาทอย่างน้อยหนึ่งบทบาทใน allowed */
export const roleProcedure = (allowed: readonly AppRole[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!hasAnyRole(ctx.session.user.roles, allowed)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ดำเนินการนี้" });
    }
    return next();
  });
