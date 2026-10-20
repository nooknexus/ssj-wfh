import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, roleProcedure } from "../trpc";
import { ATTENDANCE_REPORT_ROLES, resolveAttendanceReportScope } from "@/lib/roles";
import { TRPCError } from "@trpc/server";
import { startOfDay, endOfDay, format, addDays, isWeekend, isSameDay } from "date-fns";
import { getThaiHolidaysForRange, isHoliday } from "../utils/holidays";
import { sendMophAlert, getCheckInFlexMessage, getCheckOutFlexMessage } from "@/lib/moph-alert";
import {
  DEFAULT_AFTERNOON_START,
  blocksCheckIn,
  getLateThreshold,
  mergeApprovedPeriods,
  resolveExceptionStatus,
} from "@/lib/attendance-exception";
import { findApprovedExceptionForDay } from "../services/attendance-exception";

const getTimeSetting = async (db: Pick<PrismaClient, "systemSetting">, key: string, fallback: string) =>
  (await db.systemSetting.findUnique({ where: { setting_key: key } }))?.setting_value || fallback;

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

      // ข้อยกเว้นจากแผนงาน: อนุมัติเต็มวันแล้วไม่ต้องลงเวลา ครึ่งเช้าให้เลื่อนเวลานับสายไปช่วงบ่าย
      const approvedException = await findApprovedExceptionForDay(ctx.db, userId, today);
      if (blocksCheckIn(approvedException?.period)) {
        throw new Error("วันนี้ได้รับอนุมัติลาหรือไปราชการเต็มวันแล้ว ไม่ต้องลงเวลา");
      }

      // ตรวจสอบสถานะ (หลังเวลาเริ่มงานถือว่าสาย) ยกเว้น onsite จะไม่ถือว่าสาย
      let status: "on_time" | "late" = "on_time";
      if (input.workType !== "onsite") {
        const threshold = getLateThreshold(
          today,
          await getTimeSetting(ctx.db, "working_time", "08:30"),
          await getTimeSetting(ctx.db, "afternoon_start_time", DEFAULT_AFTERNOON_START),
          approvedException?.period,
        );
        if (today > threshold) {
          status = "late";
        }
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

  // ดึงข้อมูลประวัติการลงเวลาสำหรับผู้ดูแลระบบ
  getAdminRecords: roleProcedure(ATTENDANCE_REPORT_ROLES)
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        departmentId: z.number().optional(),
        status: z.enum(["on_time", "late", "absent", "leave", "official_trip", "holiday", "holiday_work"]).optional(),
        workType: z.enum(["wfh", "office", "onsite", "unknown"]).optional(),
        limit: z.number().min(1).max(5000).default(50),
        page: z.number().min(1).default(1),
        fetchAll: z.boolean().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, status, workType, limit, page, fetchAll, search } = input;

      // หัวหน้างานเห็นเฉพาะกลุ่มงานตัวเอง ไม่ว่า client จะส่ง departmentId อะไรมา
      const currentUser = await ctx.db.user.findUnique({
        where: { id: Number(ctx.session.user.id) },
        select: { department_id: true },
      });
      const scope = resolveAttendanceReportScope({
        roles: ctx.session.user.roles,
        ownDepartmentId: currentUser?.department_id,
        requestedDepartmentId: input.departmentId,
      });
      if ("error" in scope) {
        throw new TRPCError({ code: "FORBIDDEN", message: scope.error });
      }
      const { departmentId } = scope;

      if (!startDate || !endDate) {
        throw new Error("กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุดเพื่อค้นหาข้อมูล");
      }

      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays > 31) {
        throw new Error("กรุณาเลือกช่วงเวลาค้นหาไม่เกิน 31 วัน");
      }

      const holidays = await getThaiHolidaysForRange(startDate, endDate);
      const validDates: Date[] = [];
      let currentDate = startOfDay(startDate);
      const end = startOfDay(endDate);

      while (currentDate <= end) {
        if (!isWeekend(currentDate)) {
          validDates.push(new Date(currentDate));
        }
        currentDate = addDays(currentDate, 1);
      }

      // ดึงรายชื่อพนักงาน
      const users = await ctx.db.user.findMany({
        where: {
          ...(departmentId ? { department_id: departmentId } : {}),
          ...(search ? {
            OR: [
              { name_th: { contains: search } },
              { username: { contains: search } },
            ]
          } : {}),
        },
        include: {
          department: true,
        }
      });

      // ดึงเวลาเริ่มงานจากระบบ
      const workingTimeSetting = await ctx.db.systemSetting.findUnique({
        where: { setting_key: "working_time" }
      });
      const workingTime = workingTimeSetting?.setting_value || "08:30";
      const afternoonStart = await getTimeSetting(ctx.db, "afternoon_start_time", DEFAULT_AFTERNOON_START);

      // ดึงข้อมูลพิกัดสำนักงาน
      const officeLatSetting = await ctx.db.systemSetting.findUnique({ where: { setting_key: "office_lat" } });
      const officeLngSetting = await ctx.db.systemSetting.findUnique({ where: { setting_key: "office_lng" } });
      const officeLat = parseFloat(officeLatSetting?.setting_value || "16.8173716");
      const officeLng = parseFloat(officeLngSetting?.setting_value || "100.2584649");

      // ฟังก์ชันคำนวณระยะห่าง (เมตร)
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // Earth radius in meters
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // ดึงประวัติการลงเวลา
      const attendanceRecords = await ctx.db.attendanceRecord.findMany({
        where: {
          date: {
            gte: startOfDay(startDate),
            lte: endOfDay(endDate),
          },
          ...(departmentId ? { user: { department_id: departmentId } } : {}),
        }
      });

      // ดึงประวัติการลา (ต้องรวม leave_type)
      const leaveRequests = await ctx.db.leaveRequest.findMany({
        where: {
          start_date: { lte: endOfDay(endDate) },
          end_date: { gte: startOfDay(startDate) },
          ...(departmentId ? { user: { department_id: departmentId } } : {}),
          step2_status: 'approved', // นับเฉพาะการลาที่อนุมัติแล้ว
        },
        include: {
          leave_type: true
        }
      });

      // ข้อยกเว้นการลงเวลา (ลา / ไปราชการ จากแผนงาน) ที่อนุมัติแล้ว ไม่เกี่ยวกับใบลาด้านบน
      const approvedExceptions = await ctx.db.attendanceException.findMany({
        where: {
          status: "approved",
          date: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
          ...(departmentId ? { user: { department_id: departmentId } } : {}),
        },
      });

      const results = [];
      for (const user of users) {
        const userAttendances = attendanceRecords.filter(r => r.user_id === user.id);
        const userLeaves = leaveRequests.filter(l => l.user_id === user.id);
        const userExceptions = approvedExceptions.filter(e => e.user_id === user.id);

        for (const date of validDates) {
          const attendance = userAttendances.find(r => isSameDay(r.date, date));
          
          const dayExceptions = userExceptions.filter(e => isSameDay(e.date, date));
          const exceptionPeriod = mergeApprovedPeriods(dayExceptions.map(e => e.period));
          const onTimeThreshold = getLateThreshold(date, workingTime, afternoonStart, exceptionPeriod);

          if (attendance) {
            const checkInTime = attendance.check_in_time ? new Date(attendance.check_in_time) : null;
            const checkOutTime = attendance.check_out_time ? new Date(attendance.check_out_time) : null;
            const isHolidayDate = isHoliday(date, holidays);
            // Onsite จะไม่ถือว่าสาย
            const isLate = attendance.work_type !== "onsite" && checkInTime && !isHolidayDate && checkInTime > onTimeThreshold;
            
            // Determine status
            let finalStatus = isLate ? "late" : "on_time";
            if (isHolidayDate) {
              finalStatus = "holiday_work";
            }

            const checkInDist = attendance.check_in_lat && attendance.check_in_lng 
              ? calculateDistance(Number(attendance.check_in_lat), Number(attendance.check_in_lng), officeLat, officeLng) 
              : null;
            const checkOutDist = attendance.check_out_lat && attendance.check_out_lng 
              ? calculateDistance(Number(attendance.check_out_lat), Number(attendance.check_out_lng), officeLat, officeLng) 
              : null;

            results.push({
              id: attendance.id.toString(),
              user,
              date: attendance.date,
              work_type: attendance.work_type,
              check_in_time: attendance.check_in_time,
              check_out_time: (checkInTime?.getTime() === checkOutTime?.getTime()) ? null : attendance.check_out_time,
              status: finalStatus,
              tasks: attendance.tasks || "-",
              check_in_lat: attendance.check_in_lat,
              check_in_lng: attendance.check_in_lng,
              check_out_lat: attendance.check_out_lat,
              check_out_lng: attendance.check_out_lng,
              check_in_distance: checkInDist,
              check_out_distance: checkOutDist,
              office_lat: officeLat,
              office_lng: officeLng,
            });
          } else {
            // check leave
            const leave = userLeaves.find(l => {
              const d = startOfDay(date);
              const lStart = startOfDay(l.start_date);
              const lEnd = startOfDay(l.end_date);
              return d >= lStart && d <= lEnd;
            });
            if (leave) {
              results.push({
                id: `leave-${leave.id}-${date.getTime()}`,
                user,
                date,
                work_type: "-",
                check_in_time: null,
                check_out_time: null,
                status: "leave",
                tasks: `ลา: ${leave.leave_type.name}${leave.reason ? ` - ${leave.reason}` : ''}`,
              });
            } else if (exceptionPeriod && !isHoliday(date, holidays)) {
              const resolved = resolveExceptionStatus({ ...dayExceptions[0], period: exceptionPeriod });
              results.push({
                id: `exception-${dayExceptions[0].id}-${date.getTime()}`,
                user,
                date,
                work_type: "-",
                check_in_time: null,
                check_out_time: null,
                status: resolved.status,
                tasks: resolved.tasks,
              });
            } else if (isHoliday(date, holidays)) {
              // holiday
              results.push({
                id: `holiday-${user.id}-${date.getTime()}`,
                user,
                date,
                work_type: "-",
                check_in_time: null,
                check_out_time: null,
                status: "holiday",
                tasks: "วันหยุดนักขัตฤกษ์",
              });
            } else {
              // absent
              results.push({
                id: `absent-${user.id}-${date.getTime()}`,
                user,
                date,
                work_type: "-",
                check_in_time: null,
                check_out_time: null,
                status: "absent",
                tasks: "-",
              });
            }
          }
        }
      }

      let filteredResults = results;
      if (status) {
        filteredResults = filteredResults.filter(r => r.status === status);
      }
      if (workType) {
        filteredResults = filteredResults.filter(r => r.work_type === workType);
      }

      // Sort by date desc, then user name
      // Sort by User Name (Thai) first, then by Date Descending
      filteredResults.sort((a, b) => {
        const nameA = a.user.name_th || "";
        const nameB = b.user.name_th || "";
        const nameDiff = nameA.localeCompare(nameB, "th");
        if (nameDiff !== 0) return nameDiff;
        return b.date.getTime() - a.date.getTime();
      });

      // Paginate
      const totalItems = filteredResults.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;

      const paginatedItems = fetchAll ? filteredResults : filteredResults.slice(startIndex, startIndex + limit);

      return { items: paginatedItems, totalItems, totalPages, page };
    }),
});
