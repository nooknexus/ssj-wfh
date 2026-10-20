"use client";

import { CheckCircle2, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, type ConferencePlatform } from "@/lib/conference-booking";

export type LinkAvailability = "available" | "inactive" | "capacity_exceeded" | "unavailable";

const AVAILABILITY: Record<LinkAvailability, { label: string; className: string }> = {
  available: { label: "ว่าง", className: "bg-emerald-100 text-emerald-700" },
  unavailable: { label: "ไม่ว่าง", className: "bg-rose-100 text-rose-700" },
  capacity_exceeded: { label: "เกินความจุ", className: "bg-amber-100 text-amber-700" },
  inactive: { label: "ปิดใช้งาน", className: "bg-slate-100 text-slate-500" },
};

type LinkCardProps = {
  name: string;
  platform: ConferencePlatform;
  maxParticipants: number | null;
  description: string | null;
  availability: LinkAvailability;
  selected: boolean;
  onSelect: () => void;
};

export const LinkCard = ({ name, platform, maxParticipants, description, availability, selected, onSelect }: LinkCardProps) => {
  const isAvailable = availability === "available";
  const status = AVAILABILITY[availability];
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isAvailable}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all",
        selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:border-slate-300",
        !isAvailable && "cursor-not-allowed opacity-60 hover:border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{PLATFORM_LABELS[platform]}</p>
          </div>
        </div>
        {selected ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Users className="h-3.5 w-3.5" />
          {maxParticipants ? `สูงสุด ${maxParticipants.toLocaleString("th-TH")} คน` : "ไม่จำกัดจำนวน"}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 font-medium", status.className)}>{status.label}</span>
      </div>
      {description ? <p className="line-clamp-2 text-xs text-slate-500">{description}</p> : null}
    </button>
  );
};
