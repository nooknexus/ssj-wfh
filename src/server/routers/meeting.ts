import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getLinkAvailability,
  validateBookingRequest,
  type ConferenceBookingStatus,
} from "@/lib/conference-booking";
import { CONFERENCE_ADMIN_ROLES } from "@/lib/roles";
import { buildBookingPendingFlex, sendMorPromNotify } from "@/lib/morprom-notify";
import { formatThaiFullName } from "@/lib/person-name";
import { createTRPCRouter, protectedProcedure, roleProcedure } from "../trpc";

const statusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
const bookingInput = z.object({
  linkId: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(10_000).optional(),
  startAt: z.date(),
  endAt: z.date(),
  attendees: z.number().int().positive(),
});
const linkInput = z.object({
  name: z.string().trim().min(1).max(200),
  platform: z.enum(["zoom", "teams", "meet", "webex", "other"]),
  url: z.string().url().max(1000),
  maxParticipants: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const validationMessage: Record<Exclude<ReturnType<typeof validateBookingRequest>, { valid: true }>['code'], string> = {
  end_before_start: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
  duration_too_long: "จองได้ครั้งละไม่เกิน 8 ชั่วโมง",
  start_in_past: "ไม่สามารถจองย้อนหลังได้",
  invalid_attendees: "จำนวนผู้เข้าร่วมไม่ถูกต้อง",
  capacity_exceeded: "จำนวนผู้เข้าร่วมเกินความจุของลิงก์",
};

const assertValidBooking = (input: z.infer<typeof bookingInput>, maxParticipants: number | null) => {
  const result = validateBookingRequest({ ...input, maxParticipants });
  if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: validationMessage[result.code] });
};

const overlappingReservationWhere = (startAt: Date, endAt: Date) => ({
  status: { in: ["pending", "approved"] as ConferenceBookingStatus[] },
  start_at: { lt: endAt },
  end_at: { gt: startAt },
});

const conflictWhere = (linkId: number, startAt: Date, endAt: Date, excludeId?: number) => ({
  link_id: linkId,
  ...overlappingReservationWhere(startAt, endAt),
  ...(excludeId ? { id: { not: excludeId } } : {}),
});

export const meetingRouter = createTRPCRouter({
  getAvailableLinks: protectedProcedure
    .input(z.object({ startAt: z.date(), endAt: z.date(), attendees: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.conferenceLink.findMany({
        where: { is_active: true },
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        // ไม่ select url: ผู้ใช้เห็น URL ได้เฉพาะการจองที่อนุมัติแล้วเท่านั้น
        select: {
          id: true,
          name: true,
          platform: true,
          max_participants: true,
          description: true,
          is_active: true,
          sort_order: true,
          bookings: { where: overlappingReservationWhere(input.startAt, input.endAt), select: { start_at: true, end_at: true, status: true } },
        },
      });
      return links.map(({ bookings, ...link }) => ({
        ...link,
        availability: getLinkAvailability({
          isActive: link.is_active,
          maxParticipants: link.max_participants,
          attendees: input.attendees,
          requested: input,
          bookings: bookings.map((booking) => ({ startAt: booking.start_at, endAt: booking.end_at, status: booking.status })),
        }),
      }));
    }),

  getDaySchedule: protectedProcedure.input(z.object({ date: z.date() })).query(async ({ ctx, input }) => {
    const startAt = new Date(input.date);
    startAt.setHours(0, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + 1);
    return ctx.db.meetingBooking.findMany({
      where: { start_at: { gte: startAt, lt: endAt }, status: { in: ["pending", "approved"] } },
      select: { id: true, title: true, start_at: true, end_at: true, status: true, link: { select: { id: true, name: true, platform: true } } },
      orderBy: { start_at: "asc" },
    });
  }),

  createBooking: protectedProcedure.input(bookingInput).mutation(async ({ ctx, input }) => {
    const { booking, link, requester } = await ctx.db.$transaction(async (tx) => {
      const userId = Number(ctx.session.user.id);
      const [link, requester] = await Promise.all([
        tx.conferenceLink.findUnique({ where: { id: input.linkId } }),
        tx.user.findUnique({
          where: { id: userId },
          select: { department_id: true, title_th: true, name_th: true, name_eng: true, department: { select: { name: true } } },
        }),
      ]);
      if (!link || !link.is_active) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์ที่เปิดใช้งาน" });
      assertValidBooking(input, link.max_participants);
      const conflict = await tx.meetingBooking.findFirst({ where: conflictWhere(input.linkId, input.startAt, input.endAt) });
      if (conflict) throw new TRPCError({ code: "CONFLICT", message: "ลิงก์นี้ถูกจองในช่วงเวลาที่เลือกแล้ว" });
      const booking = await tx.meetingBooking.create({
        data: { link_id: input.linkId, user_id: userId, department_id: requester?.department_id ?? null, title: input.title, description: input.description, start_at: input.startAt, end_at: input.endAt, attendees: input.attendees, status: "pending" },
      });
      return { booking, link, requester };
    }, { isolationLevel: "Serializable" });

    // แจ้งผู้ดูแล IT ในกลุ่ม MorProm หลังบันทึกสำเร็จ ไม่รอผล การแจ้งเตือนล้มต้องไม่ทำให้จองไม่สำเร็จ
    void sendMorPromNotify({
      messages: [
        buildBookingPendingFlex({
          title: booking.title,
          linkName: link.name,
          platform: link.platform,
          startAt: booking.start_at,
          endAt: booking.end_at,
          attendees: booking.attendees,
          requesterName: formatThaiFullName(requester?.title_th, requester?.name_th) || requester?.name_eng,
          departmentName: requester?.department?.name,
          bookedAt: booking.created_at,
        }),
      ],
    });

    return booking;
  }),

  getMyBookings: protectedProcedure.query(async ({ ctx }) => {
    const bookings = await ctx.db.meetingBooking.findMany({
      where: { user_id: Number(ctx.session.user.id) },
      include: { link: { select: { id: true, name: true, platform: true, url: true, max_participants: true } } },
      orderBy: { start_at: "desc" },
    });
    return bookings.map((booking) => booking.status === "approved"
      ? booking
      : { ...booking, link: { ...booking.link, url: undefined } });
  }),

  cancelBooking: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const booking = await ctx.db.meetingBooking.findFirst({ where: { id: input.id, user_id: Number(ctx.session.user.id) } });
    if (!booking) throw new TRPCError({ code: "FORBIDDEN", message: "ไม่สามารถยกเลิกรายการนี้ได้" });
    if (booking.status !== "pending" && booking.status !== "approved") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "รายการนี้ยกเลิกไม่ได้" });
    }
    if (booking.start_at <= new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "ยกเลิกได้ก่อนเวลาเริ่มเท่านั้น" });
    return ctx.db.meetingBooking.update({ where: { id: input.id }, data: { status: "cancelled" } });
  }),

  getAllBookings: roleProcedure(CONFERENCE_ADMIN_ROLES)
    .input(z.object({ status: statusSchema.optional(), from: z.date().optional(), to: z.date().optional() }).optional())
    .query(({ ctx, input }) => ctx.db.meetingBooking.findMany({
      where: { ...(input?.status ? { status: input.status } : {}), ...(input?.from || input?.to ? { start_at: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}) },
      include: {
        user: { select: { id: true, name_th: true, position: true, department: { select: { name: true } } } },
        link: true,
      },
      orderBy: { start_at: "desc" },
    })),

  updateBookingStatus: roleProcedure(CONFERENCE_ADMIN_ROLES)
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), rejectReason: z.string().trim().max(10_000).optional() }))
    .mutation(({ ctx, input }) => ctx.db.$transaction(async (tx) => {
      const booking = await tx.meetingBooking.findUnique({ where: { id: input.id } });
      if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรายการจอง" });
      if (booking.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "รายการนี้ได้รับการพิจารณาหรือถูกยกเลิกแล้ว" });
      if (input.status === "approved") {
        const conflict = await tx.meetingBooking.findFirst({ where: conflictWhere(booking.link_id, booking.start_at, booking.end_at, booking.id) });
        if (conflict) throw new TRPCError({ code: "CONFLICT", message: "ไม่สามารถอนุมัติได้เพราะเวลาชนกับรายการอื่น" });
      }
      return tx.meetingBooking.update({ where: { id: booking.id }, data: { status: input.status, approved_by: Number(ctx.session.user.id), approved_at: new Date(), reject_reason: input.status === "rejected" ? input.rejectReason : null } });
    }, { isolationLevel: "Serializable" })),

  // จำนวนการจองที่รออนุมัติ สำหรับตัวเลขบนเมนูผู้ดูแล
  pendingCount: roleProcedure(CONFERENCE_ADMIN_ROLES).query(({ ctx }) =>
    ctx.db.meetingBooking.count({ where: { status: "pending" } })),

  listLinks: roleProcedure(CONFERENCE_ADMIN_ROLES).query(({ ctx }) =>
    ctx.db.conferenceLink.findMany({ orderBy: [{ sort_order: "asc" }, { name: "asc" }] })),

  createLink: roleProcedure(CONFERENCE_ADMIN_ROLES).input(linkInput).mutation(({ ctx, input }) =>
    ctx.db.conferenceLink.create({ data: { name: input.name, platform: input.platform, url: input.url, max_participants: input.maxParticipants, description: input.description, is_active: input.isActive ?? true, sort_order: input.sortOrder ?? 0 } })),

  updateLink: roleProcedure(CONFERENCE_ADMIN_ROLES).input(linkInput.extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) =>
    ctx.db.conferenceLink.update({ where: { id: input.id }, data: { name: input.name, platform: input.platform, url: input.url, max_participants: input.maxParticipants, description: input.description, is_active: input.isActive, sort_order: input.sortOrder } })),
});
