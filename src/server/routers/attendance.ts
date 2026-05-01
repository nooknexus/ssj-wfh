import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { startOfDay, endOfDay, format } from "date-fns";
import { sendMophAlert, getCheckInFlexMessage, getCheckOutFlexMessage } from "@/lib/moph-alert";

export const attendanceRouter = createTRPCRouter({
  // ตรวจสอบสถานะการลงเวลาของวันนี้
  getTodayStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = parseInt((ctx.session.user as any).id);
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);

    return ctx.db.attendanceRecord.findFirst({
      where: {
        user_id: userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        photos: true,
      },
    });
  }),

  // ลงเวลาเข้างาน
  checkIn: protectedProcedure
    .input(
      z.object({
        workType: z.enum(["wfh", "office", "official_trip", "onsite"]),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = parseInt((ctx.session.user as any).id);
      const today = new Date();
      const start = startOfDay(today);
      const end = endOfDay(today);

      // ตรวจสอบว่าวันนี้ลงเวลาไปหรือยัง
      const existing = await ctx.db.attendanceRecord.findFirst({
        where: {
          user_id: userId,
          date: {
            gte: start,
            lte: end,
          },
        },
      });

      if (existing) {
        throw new Error("วันนี้คุณลงเวลาเข้างานไปแล้ว");
      }

      // ตรวจสอบสถานะ (ถ้าหลัง 8:30 ถือว่าสาย - ตรรกะตัวอย่าง)
      let status: "on_time" | "late" = "on_time";
      const checkInHour = today.getHours();
      const checkInMinute = today.getMinutes();
      if (checkInHour > 8 || (checkInHour === 8 && checkInMinute > 30)) {
        status = "late";
      }

      // ถ้าเป็น WFH ต้องตรวจสอบว่ามีคำขอที่อนุมัติแล้วหรือไม่
      if (input.workType === "wfh") {
        const approvedWfh = await ctx.db.wfhRequest.findFirst({
          where: {
            user_id: userId,
            status: "approved",
            start_date: { lte: today },
            end_date: { gte: startOfDay(today) },
          },
        });

        if (!approvedWfh) {
          throw new Error("ไม่สามารถลงเวลา WFH ได้ เนื่องจากไม่มีคำขอที่ได้รับการอนุมัติในวันนี้");
        }
      }

      const record = await ctx.db.attendanceRecord.create({
        data: {
          user_id: userId,
          date: today,
          work_type: input.workType,
          check_in_time: today,
          check_in_lat: input.lat,
          check_in_lng: input.lng,
          status: status,
        },
      });

      // ส่ง Line OA MOPH Alert แบบรายบุคคล
      try {
        const checkinEnabledSetting = await ctx.db.systemSetting.findUnique({
          where: { setting_key: "moph_alert_checkin_enabled" }
        });
        const isCheckinAlertEnabled = checkinEnabledSetting ? checkinEnabledSetting.setting_value === "true" : true;

        if (isCheckinAlertEnabled) {
          const user = await ctx.db.user.findUnique({ where: { id: userId } });
          if (user && user.username && user.username.length === 13) {
            const timeString = format(today, "HH:mm น.");
            await sendMophAlert({
              cid: [user.username],
              messages: [getCheckInFlexMessage(timeString)],
              message_title: "ยืนยันลงเวลาเข้างาน",
              message_html: "<div><strong>ยืนยันการลงเวลาเข้างานสำเร็จ</strong></div>",
              message_text: `คุณได้ลงเวลาเข้างานเรียบร้อยแล้ว เมื่อเวลา ${timeString}`,
              message_type: "HPT"
            });
          }
        }
      } catch (err) {
        console.error("Failed to send MOPH Alert on check-in:", err);
      }

      return record;
    }),

  // ลงเวลาออกงาน
  checkOut: protectedProcedure
    .input(
      z.object({
        tasks: z.string().optional(),
        missionDetail: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = parseInt((ctx.session.user as any).id);
      const today = new Date();
      const start = startOfDay(today);
      const end = endOfDay(today);

      const existing = await ctx.db.attendanceRecord.findFirst({
        where: {
          user_id: userId,
          date: {
            gte: start,
            lte: end,
          },
        },
      });

      if (!existing) {
        throw new Error("ไม่พบข้อมูลการลงเวลาเข้างานของวันนี้ กรุณาลงเวลาเข้างานก่อน");
      }

      if (existing.check_out_time) {
        throw new Error("วันนี้คุณลงเวลาออกงานไปแล้ว");
      }

      const record = await ctx.db.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          check_out_time: today,
          check_out_lat: input.lat,
          check_out_lng: input.lng,
          tasks: input.tasks,
          mission_detail: input.missionDetail,
        },
      });

      // ส่ง Line OA MOPH Alert แจ้งยืนยันการลงเวลาออกงาน
      try {
        const checkoutEnabledSetting = await ctx.db.systemSetting.findUnique({
          where: { setting_key: "moph_alert_checkout_enabled" }
        });
        const isCheckoutAlertEnabled = checkoutEnabledSetting ? checkoutEnabledSetting.setting_value === "true" : true;

        if (isCheckoutAlertEnabled) {
          const user = await ctx.db.user.findUnique({ where: { id: userId } });
          if (user && user.username && user.username.length === 13) {
            const timeString = format(today, "HH:mm น.");
            await sendMophAlert({
              cid: [user.username],
              messages: [getCheckOutFlexMessage(timeString)],
              message_title: "ยืนยันลงเวลาออกงาน",
              message_html: "<div><strong>ยืนยันการลงเวลาออกงานสำเร็จ</strong></div>",
              message_text: `คุณได้ลงเวลาออกงานเรียบร้อยแล้ว เมื่อเวลา ${timeString}`,
              message_type: "HPT"
            });
          }
        }
      } catch (err) {
        console.error("Failed to send MOPH Alert on check-out:", err);
      }

      return record;
    }),

  // ดึงประวัติการลงเวลา
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const userId = parseInt((ctx.session.user as any).id);
      return ctx.db.attendanceRecord.findMany({
        where: {
          user_id: userId,
        },
        include: {
          photos: true,
        },
        orderBy: {
          date: "desc",
        },
        take: input.limit,
      });
    }),
});
