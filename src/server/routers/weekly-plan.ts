import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { startOfWeek, addDays } from "date-fns";

export const weeklyPlanRouter = createTRPCRouter({
  getPlan: protectedProcedure
    .input(z.object({ date: z.date() }))
    .query(async ({ ctx, input }) => {
      const userId = parseInt((ctx.session.user as any).id);
      
      // ปรับให้เป็นเวลาเที่ยงวันก่อนหาจุดเริ่มสัปดาห์ เพื่อเลี่ยงปัญหา Timezone ขอบวัน
      const normalizedDate = new Date(input.date);
      normalizedDate.setHours(12, 0, 0, 0);
      
      const weekStart = startOfWeek(normalizedDate, { weekStartsOn: 0 });
      const dayAfter = addDays(weekStart, 1);
      const dayBefore = addDays(weekStart, -1);

      return ctx.db.weeklyPlan.findFirst({
        where: {
          user_id: userId,
          week_start: {
            gte: dayBefore,
            lt: dayAfter,
          },
        },
        orderBy: {
          updated_at: "desc"
        }
      });
    }),

  savePlan: protectedProcedure
    .input(
      z.object({
        date: z.date(),
        planData: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = parseInt((ctx.session.user as any).id);
      
      const normalizedDate = new Date(input.date);
      normalizedDate.setHours(12, 0, 0, 0);
      
      const weekStart = startOfWeek(normalizedDate, { weekStartsOn: 0 });
      const dayAfter = addDays(weekStart, 1);
      const dayBefore = addDays(weekStart, -1);

      const existingPlan = await ctx.db.weeklyPlan.findFirst({
        where: {
          user_id: userId,
          week_start: {
            gte: dayBefore,
            lt: dayAfter,
          },
        },
      });

      if (existingPlan) {
        return ctx.db.weeklyPlan.update({
          where: { id: existingPlan.id },
          data: { plan_data: input.planData },
        });
      }

      return ctx.db.weeklyPlan.create({
        data: {
          user_id: userId,
          week_start: weekStart,
          plan_data: input.planData,
        },
      });
    }),
});
