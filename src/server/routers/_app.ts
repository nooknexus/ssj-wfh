import { createTRPCRouter, publicProcedure } from "../trpc";
import { authRouter } from "./auth";
import { leaveRouter } from "./leave";
import { meetingRouter } from "./meeting";
import { documentRouter } from "./document";
import { userRouter } from "./user";
import { attendanceRouter } from "./attendance";
import { wfhRouter } from "./wfh";
import { weeklyPlanRouter } from "./weekly-plan";
import { departmentRouter } from "./department";
import { systemSettingRouter } from "./system-setting";
import { dashboardRouter } from "./dashboard";

export const appRouter = createTRPCRouter({
  healthcheck: publicProcedure.query(() => {
    return "ok";
  }),
  auth: authRouter,
  dashboard: dashboardRouter,
  leave: leaveRouter,
  meeting: meetingRouter,
  document: documentRouter,
  user: userRouter,
  attendance: attendanceRouter,
  wfh: wfhRouter,
  weeklyPlan: weeklyPlanRouter,
  department: departmentRouter,
  systemSetting: systemSettingRouter,
});

export type AppRouter = typeof appRouter;
