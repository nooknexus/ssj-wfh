"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getRoleLabel } from "@/lib/roles";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  Clock,
  Settings,
  LogOut,
  Building2,
  ListTodo,
  Menu,
  X
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { APP_CONFIG } from "@/lib/constants";
import { getAdminNavigation } from "@/lib/roles";
import { trpc } from "@/trpc/client";
import Image from "next/image";
import logo from "./logo.png";
import { useState, useEffect } from "react";

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
  clock: Clock,
};

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  const { data: settings } = trpc.systemSetting.getAll.useQuery();
  const adminNavigation = getAdminNavigation(session?.user?.role);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navigation = navigationItems;

  const user = session?.user;
  const displayName = user?.name_th || user?.name || "ไม่ระบุชื่อ";
  const displayRole = getRoleLabel(user?.role);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-xl bg-white shadow-lg border border-emerald-100 text-emerald-600 md:hidden hover:bg-emerald-50 transition-colors"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed inset-y-4 left-4 z-40 w-72 transition-all duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+2rem)]"
        )}
      >
        <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden ring-1 ring-slate-900/5">
          {/* Logo Section */}
          <div className="flex h-20 shrink-0 items-center px-8 border-b border-slate-100/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200">
                <Image src={logo} alt="Logo" width={28} height={28} className="object-contain brightness-0 invert" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 tracking-tight leading-tight">
                  {settings?.sys_name || APP_CONFIG.name}
                </span>
                {settings?.org_name && (
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5 opacity-80">
                    {settings.org_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Navigation Section */}
          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 custom-scrollbar">
            <nav className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">
                Main Menu
              </div>
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                        : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700",
                      "group flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-200"
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-600",
                        "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}

              {adminNavigation.length > 0 && (
                <>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-8 mb-4 px-4">
                    Administrator
                  </div>
                  {adminNavigation.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = adminIcons[item.icon as keyof typeof adminIcons] || Settings;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          isActive
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                            : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700",
                          "group flex items-center px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-200"
                        )}
                      >
                        <Icon
                          className={cn(
                            isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-600",
                            "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                          )}
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>
          </div>

          {/* User Profile / Logout Section */}
          <div className="p-4 mt-auto">
            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-2">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden border border-emerald-200/50 shadow-sm">
                    {user?.image ? (
                      <img src={user.image} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      displayName.substring(0, 1)
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-800 truncate">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                      {displayRole}
                    </span>
                  </div>
               </div>
               <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="group flex w-full items-center px-4 py-2.5 text-xs font-bold text-rose-500 rounded-xl hover:bg-rose-50 transition-all duration-200"
              >
                <LogOut className="mr-3 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

