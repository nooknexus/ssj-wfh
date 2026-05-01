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

  const displayName = user?.name || "ไม่ระบุชื่อ";
  const displayRole = getRoleLabel(user?.role);
  const displayEmail = user?.email || "";

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200">
      <div className="flex-1">
        {/* Placeholder for left side of header, e.g., page title or breadcrumbs */}
      </div>

      <div className="flex items-center gap-4">
        {user?.role !== "staff" && (
          <Button variant="ghost" size="icon" className="relative text-slate-500">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "relative h-10 flex items-center gap-2 rounded-full px-2 hover:bg-slate-100 outline-none"
          )}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.image || ""} alt={displayName} />
              <AvatarFallback className="bg-blue-600 text-white text-xs">{displayName.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start text-sm">
              <span className="font-medium text-slate-700 leading-none">{displayName}</span>
              <span className="text-xs text-slate-500 mt-0.5">{displayRole}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {displayEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                โปรไฟล์ส่วนตัว
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                ตั้งค่าบัญชี
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <Button 
          variant="ghost" 
          size="icon" 
          className="text-slate-500 hover:text-red-600 hover:bg-red-50"
          title="ออกจากระบบ"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
