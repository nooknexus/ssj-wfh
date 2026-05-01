import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const meetingRouter = createTRPCRouter({
  // Get all active rooms
  getRooms: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.meetingRoom.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        name: "asc",
      },
    });
  }),

  // Get user's bookings
  getMyBookings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.meetingBooking.findMany({
      where: {
        user_id: parseInt((ctx.session.user as any).id),
      },
      include: {
        room: true,
      },
      orderBy: {
        date: "desc",
      },
    });
  }),

  // Get all pending bookings for Admin
  getPendingBookings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.meetingBooking.findMany({
      where: {
        status: "pending",
      },
      include: {
        user: true,
        room: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }),

  // Create a new booking
  createBooking: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        date: z.date(),
        startTime: z.string(), // "09:00" format expected (or Date object depending on how we handle it)
        endTime: z.string(),   // "10:00" format expected
        attendees: z.number().min(1),
        equipmentNeeds: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Basic availability check logic can go here
      // For now, assume it's created as pending
      
      // Parse time to actual Date object or store as DateTime if needed.
      // Schema uses `@db.Time`, but Prisma might treat it as Date with 1970 date part.
      // Let's create dummy dates for time fields just to satisfy Prisma,
      // or map them to proper Date objects relative to `input.date`.
      
      const startTimeParts = input.startTime.split(":");
      const sTime = new Date(input.date);
      sTime.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0, 0);
      
      const endTimeParts = input.endTime.split(":");
      const eTime = new Date(input.date);
      eTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0);

      return ctx.db.meetingBooking.create({
        data: {
          room_id: input.roomId,
          user_id: parseInt((ctx.session.user as any).id),
          title: input.title,
          description: input.description,
          date: input.date,
          start_time: sTime,
          end_time: eTime,
          attendees: input.attendees,
          equipment_needs: input.equipmentNeeds,
          status: "pending",
        },
      });
    }),

  // Approve/Reject booking
  updateBookingStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        rejectReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.meetingBooking.update({
        where: { id: input.id },
        data: { 
          status: input.status,
          approved_by: parseInt((ctx.session.user as any).id),
          approved_at: new Date(),
          reject_reason: input.rejectReason
        },
      });
    }),
});
