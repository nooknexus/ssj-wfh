"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONFERENCE_PLATFORMS, PLATFORM_LABELS, type ConferencePlatform } from "@/lib/conference-booking";
import { trpc } from "@/trpc/client";

export type ConferenceLinkFormValue = {
  id?: number;
  name: string;
  platform: ConferencePlatform;
  url: string;
  max_participants: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export const EMPTY_LINK: ConferenceLinkFormValue = {
  name: "",
  platform: "zoom",
  url: "",
  max_participants: null,
  description: null,
  is_active: true,
  sort_order: 0,
};

type LinkFormDialogProps = {
  initial: ConferenceLinkFormValue;
  onClose: () => void;
};

export const LinkFormDialog = ({ initial, onClose }: LinkFormDialogProps) => {
  const [form, setForm] = useState(initial);
  const utils = trpc.useUtils();
  const options = {
    onSuccess: async () => {
      await utils.meeting.invalidate();
      toast.success(initial.id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มลิงก์แล้ว");
      onClose();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const createLink = trpc.meeting.createLink.useMutation(options);
  const updateLink = trpc.meeting.updateLink.useMutation(options);
  const isSaving = createLink.isPending || updateLink.isPending;
  const set = <K extends keyof ConferenceLinkFormValue>(key: K, value: ConferenceLinkFormValue[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const payload = {
      name: form.name,
      platform: form.platform,
      url: form.url.trim(),
      maxParticipants: form.max_participants,
      description: form.description || null,
      isActive: form.is_active,
      sortOrder: form.sort_order,
    };
    if (initial.id) updateLink.mutate({ ...payload, id: initial.id });
    else createLink.mutate(payload);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{initial.id ? "แก้ไขลิงก์ Web Conference" : "เพิ่มลิงก์ Web Conference"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="link-name">ชื่อลิงก์</Label>
            <Input id="link-name" value={form.name} maxLength={200} placeholder="เช่น Zoom สสจ. บัญชี 1" onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="link-platform">แพลตฟอร์ม</Label>
              <Select value={form.platform} onValueChange={(value) => value && set("platform", value as ConferencePlatform)}>
                <SelectTrigger id="link-platform" className="w-full">
                  <SelectValue>{PLATFORM_LABELS[form.platform]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CONFERENCE_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>{PLATFORM_LABELS[platform]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-max">ผู้เข้าร่วมสูงสุด (คน)</Label>
              <Input
                id="link-max"
                type="number"
                min={1}
                placeholder="ไม่จำกัด"
                value={form.max_participants ?? ""}
                onChange={(e) => set("max_participants", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL ห้องประชุม</Label>
            <Input id="link-url" type="url" value={form.url} maxLength={1000} placeholder="https://..." onChange={(e) => set("url", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-description">รายละเอียด (ไม่บังคับ)</Label>
            <Textarea id="link-description" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
            <Label htmlFor="link-active">เปิดให้จอง</Label>
            <Switch id="link-active" checked={form.is_active} onCheckedChange={(checked) => set("is_active", checked)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.url.trim()} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
