import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";


export const documentRouter = createTRPCRouter({
  // Get all documents for dashboard/list (filter by type if provided)
  getDocuments: protectedProcedure
    .input(z.object({
      type: z.enum(["inbound", "outbound", "order", "memo"]).optional(),
      status: z.enum(["new", "pending", "in_progress", "completed"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.type) where.doc_type = input.type;
      if (input?.status) where.status = input.status;
      
      return ctx.db.document.findMany({
        where,
        include: {
          assignee: true,
          creator: true,
          department: true,
          attachments: true,
        },
        orderBy: {
          doc_date: "desc",
        },
      });
    }),

  // Get single document details
  getDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.document.findUnique({
        where: { id: input.id },
        include: {
          assignee: true,
          creator: true,
          department: true,
          attachments: true,
        },
      });
    }),

  // Get statistics for dashboard
  getStats: protectedProcedure.query(async ({ ctx }) => {
    // For simplicity, we fetch all stats in parallel
    const [inbound, outbound, order, memo, pending] = await Promise.all([
      ctx.db.document.count({ where: { doc_type: "inbound" } }),
      ctx.db.document.count({ where: { doc_type: "outbound" } }),
      ctx.db.document.count({ where: { doc_type: "order" } }),
      ctx.db.document.count({ where: { doc_type: "memo" } }),
      ctx.db.document.count({ where: { status: "pending" } }),
    ]);

    return { inbound, outbound, order, memo, pending };
  }),

  // Create document
  create: protectedProcedure
    .input(z.object({
      doc_type: z.enum(["inbound", "outbound", "order", "memo"]),
      doc_number: z.string().optional(),
      from_to: z.string().min(1),
      subject: z.string().min(1),
      doc_date: z.date(),
      assigned_to: z.number().optional(),
      department_id: z.number().optional(),
      remark: z.string().optional(),
      attachments: z.array(z.object({
        file_name: z.string(),
        file_path: z.string(),
        file_size: z.number().optional(),
        mime_type: z.string().optional(),
      })).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.document.create({
        data: {
          doc_type: input.doc_type,
          doc_number: input.doc_number ?? null,
          from_to: input.from_to,
          subject: input.subject,
          doc_date: input.doc_date,
          assigned_to: input.assigned_to,
          department_id: input.department_id,
          remark: input.remark,
          created_by: parseInt((ctx.session.user as any).id),
          status: "new",
          attachments: {
            create: input.attachments?.map(att => ({
              file_name: att.file_name,
              file_path: att.file_path,
              file_size: att.file_size ?? null,
              mime_type: att.mime_type ?? null,
              uploaded_by: parseInt((ctx.session.user as any).id)
            })) ?? []
          }
        },
      });
    }),

  // Create document (legacy alias)
  createDocument: protectedProcedure
    .input(z.object({
      doc_type: z.enum(["inbound", "outbound", "order", "memo"]),
      doc_number: z.string().optional(),
      from_to: z.string().min(1),
      subject: z.string().min(1),
      doc_date: z.date(),
      assigned_to: z.number().optional(),
      department_id: z.number().optional(),
      remark: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.document.create({
        data: {
          doc_type: input.doc_type,
          doc_number: input.doc_number ?? null,
          from_to: input.from_to,
          subject: input.subject,
          doc_date: input.doc_date,
          assigned_to: input.assigned_to,
          department_id: input.department_id,
          remark: input.remark,
          created_by: parseInt((ctx.session.user as any).id),
          status: "new",
        },
      });
    }),

  // Update document status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "pending", "in_progress", "completed"]),
      remark: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.document.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.remark && { remark: input.remark })
        },
      });
    }),

  // Delete document
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Must delete attachments first if DB lacks cascade delete, 
      // but Prisma schema should handle it if relation is setup.
      // Doing it manually to be safe.
      await ctx.db.documentAttachment.deleteMany({
        where: { document_id: input.id }
      });

      return ctx.db.document.delete({
        where: { id: input.id },
      });
    }),
    

});
