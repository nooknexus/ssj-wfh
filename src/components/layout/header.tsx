"use client";

import { Bell, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "next-auth/react";
import { getRoleLabel } from "@/lib/roles";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  const displayName = user?.name_th || user?.name || "ไม่ระบุชื่อ";
  const displayRole = getRoleLabel(user?.role);
  const displayEmail = user?.email || "";

  return (
    <header className="h-20 flex items-center justify-between px-8 sticky top-0 z-30 bg-white/40 backdrop-blur-md border-b border-white/20">
      <div className="flex-1">
        {/* Mobile Spacer for Toggle Button */}
        <div className="md:hidden w-12" />
        <h2 className="hidden md:block text-lg font-bold text-slate-800 tracking-tight">
          Welcome back, <span className="text-emerald-600">{displayName}</span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {user?.role !== "staff" && (
          <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(
            "relative h-12 flex items-center gap-3 rounded-2xl px-3 hover:bg-white/50 border border-transparent hover:border-white shadow-none transition-all outline-none"
          )}>
            <div className="relative">
              <Avatar className="h-9 w-9 border-2 border-emerald-100 shadow-sm">
                <AvatarImage src={user?.image || ""} alt={displayName} />
                <AvatarFallback className="bg-emerald-600 text-white text-xs font-bold">{displayName.substring(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="hidden lg:flex flex-col items-start text-sm">
              <span className="font-bold text-slate-800 leading-none">{displayName}</span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1">{displayRole}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 mt-2 p-2 rounded-2xl border-white/50 bg-white/90 backdrop-blur-xl shadow-2xl" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold text-slate-800">{displayName}</p>
                  <p className="text-xs font-medium text-slate-500">
                    {displayEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-100" />
              <div className="mt-1 space-y-1">
                <DropdownMenuItem className="cursor-pointer rounded-xl py-2.5 px-3 focus:bg-emerald-50 focus:text-emerald-700 font-medium">
                  โปรไฟล์ส่วนตัว
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer rounded-xl py-2.5 px-3 focus:bg-emerald-50 focus:text-emerald-700 font-medium">
                  ตั้งค่าบัญชี
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem 
                className="cursor-pointer rounded-xl py-2.5 px-3 focus:bg-rose-50 text-rose-500 focus:text-rose-600 font-bold mt-1"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="w-4 h-4 mr-2" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
