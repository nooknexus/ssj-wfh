"use client";

import { useState } from "react";
import { Link2, ListChecks, Video } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AdminBookingsPanel } from "@/components/meeting/admin-bookings-panel";
import { AdminLinksPanel } from "@/components/meeting/admin-links-panel";
import { trpc } from "@/trpc/client";

type Tab = "bookings" | "links";

export default function AdminMeetingPage() {
  const [tab, setTab] = useState<Tab>("bookings");
  const { data: pendingCount } = trpc.meeting.pendingCount.useQuery();

  const tabs: Array<{ value: Tab; label: string; icon: typeof ListChecks; badge?: number }> = [
    { value: "bookings", label: "การจอง", icon: ListChecks, badge: pendingCount },
    { value: "links", label: "จัดการลิงก์", icon: Link2 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Video className="h-6 w-6 text-indigo-600" />
          จัดการ Web Conference
        </h1>
        <p className="mt-1 text-slate-500">อนุมัติการจอง และจัดการลิงก์ห้องประชุมออนไลน์</p>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-0">
          <div className="flex" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-colors",
                  tab === item.value ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.badge ? (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{item.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          {tab === "bookings" ? <AdminBookingsPanel /> : <AdminLinksPanel />}
        </CardContent>
      </Card>
    </div>
  );
}
