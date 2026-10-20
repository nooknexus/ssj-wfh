"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLATFORM_LABELS } from "@/lib/conference-booking";
import { trpc } from "@/trpc/client";
import { EMPTY_LINK, LinkFormDialog, type ConferenceLinkFormValue } from "./link-form-dialog";

export const AdminLinksPanel = () => {
  const [editing, setEditing] = useState<ConferenceLinkFormValue | null>(null);
  const { data: links, isLoading } = trpc.meeting.listLinks.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-6 pt-6">
        <p className="text-sm text-slate-500">ปิดใช้งานแทนการลบ เพื่อเก็บประวัติการจองเดิมไว้</p>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setEditing(EMPTY_LINK)}>
          <Plus className="mr-1.5 h-4 w-4" />
          เพิ่มลิงก์
        </Button>
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : !links || links.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">ยังไม่มีลิงก์ กดปุ่มเพิ่มลิงก์เพื่อเริ่มต้น</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="pl-6 text-xs">ชื่อลิงก์</TableHead>
                <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                <TableHead className="text-xs">ผู้เข้าร่วมสูงสุด</TableHead>
                <TableHead className="text-center text-xs">สถานะ</TableHead>
                <TableHead className="pr-6 text-right text-xs">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="pl-6">
                    <p className="text-sm font-medium text-slate-900">{link.name}</p>
                    <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[260px] items-center gap-1 truncate text-xs text-blue-600 hover:underline">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link.url}</span>
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{PLATFORM_LABELS[link.platform]}</TableCell>
                  <TableCell className="text-sm text-slate-700">{link.max_participants ? `${link.max_participants.toLocaleString("th-TH")} คน` : "ไม่จำกัด"}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={link.is_active ? "border-0 bg-emerald-100 text-emerald-700" : "border-0 bg-slate-100 text-slate-500"}>
                      {link.is_active ? "เปิดให้จอง" : "ปิดใช้งาน"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50" onClick={() => setEditing(link)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      แก้ไข
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing ? <LinkFormDialog key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
};
