import { createTRPCRouter, protectedProcedure, publicProcedure, roleProcedure } from "../trpc";
import { USER_MANAGER_ROLES } from "@/lib/roles";
import { z } from "zod";

export const systemSettingRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.systemSetting.findMany();
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {} as Record<string, string>);

    // Define defaults for known modules
    const defaults: Record<string, string> = {
      module_attendance: "true",
      module_weekly_plan: "true",
      module_leave: "true",
      module_meeting: "true",
      module_document: "true",
      allow_registration: "true",
      sys_name: "WFH System",
      moph_alert_checkin_enabled: "true",
      moph_alert_checkout_enabled: "true",
      moph_alert_reminder_enabled: "true",
      office_radius: "100",
      office_lat: "16.8173716",
      office_lng: "100.2584649",
      allow_manual_location: "true",
    };

    return { ...defaults, ...settingsMap };
  }),

  getPublicSettings: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.systemSetting.findMany({
      where: {
        setting_key: {
          in: ["sys_name", "org_name", "sys_description"]
        }
      }
    });
    
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {} as Record<string, string>);

    const defaults: Record<string, string> = {
      sys_name: "WFH System",
    };

    return { ...defaults, ...settingsMap };
  }),

  update: roleProcedure(USER_MANAGER_ROLES)
    .input(z.object({ settings: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const { settings } = input;

      const updates = Object.entries(settings).map(([key, value]) => {
        return ctx.db.systemSetting.upsert({
          where: { setting_key: key },
          update: { setting_value: value },
          create: { setting_key: key, setting_value: value },
        });
      });

      await Promise.all(updates);
      return { success: true };
    }),
});
