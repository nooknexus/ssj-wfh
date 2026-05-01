"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  Clock,
  Settings,
  LogOut,
  Building2,
  ListTodo
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { APP_CONFIG } from "@/lib/constants";
import { getAdminNavigation } from "@/lib/roles";
import { trpc } from "@/trpc/client";
import Image from "next/image";
import logo from "./logo.png";

const navigationItems = [
  { name: "แดชบอร์ด", href: "/", icon: LayoutDashboard, key: "dashboard" },
  { name: "ระบบลงเวลาปฏิบัติงาน", href: "/attendance", icon: Clock, key: "module_attendance" },
  { name: "แผนงานล่วงหน้ารายสัปดาห์", href: "/weekly-plan", icon: ListTodo, key: "module_weekly_plan" },
  { name: "ระบบลาออนไลน์", href: "/leave", icon: CalendarDays, key: "module_leave" },
  { name: "ระบบจองWeb Conference", href: "/meeting", icon: Users, key: "module_meeting" },
  { name: "ระบบงานสารบรรณกลุ่มงาน", href: "/document", icon: FileText, key: "module_document" },
];

const adminIcons = {
  users: Users,
  building2: Building2,
  fileText: FileText,
  settings: Settings,
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: settings } = trpc.systemSetting.getAll.useQuery();
  const adminNavigation = getAdminNavigation(session?.user?.role);

  const navigation = navigationItems;

  return (
    <div className="flex flex-col w-64 bg-slate-900 text-slate-300 transition-all duration-300">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Image src={logo} alt="Logo" width={32} height={32} className="object-contain drop-shadow-sm" />
          <div className="flex flex-col">
            <span className="font-bold text-white tracking-tight leading-none">
              {settings?.sys_name || APP_CONFIG.name}
            </span>
            {settings?.org_name && (
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
                {settings.org_name}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="flex-1 space-y-1 px-3 py-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
            เมนูหลัก
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400",
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}

          {adminNavigation.length > 0 && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-2 px-3">
                ผู้ดูแลระบบ
              </div>
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = adminIcons[item.icon];
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                      "group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors"
                    )}
                  >
                    <Icon
                      className={cn(
                        isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-400",
                        "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 p-4 border-t border-slate-800">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="group flex w-full items-center px-3 py-2.5 text-sm font-medium text-slate-300 rounded-md hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-slate-400 group-hover:text-red-400 transition-colors" aria-hidden="true" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
