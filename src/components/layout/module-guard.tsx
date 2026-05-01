"use client";

import { trpc } from "@/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Hammer, Home } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ModuleGuardProps {
  moduleKey: string;
  children: React.ReactNode;
}

export function ModuleGuard({ moduleKey, children }: ModuleGuardProps) {
  const { data: settings, isLoading } = trpc.systemSetting.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isEnabled = settings?.[moduleKey] !== "false";

  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <Card className="max-w-md w-full border-amber-100 bg-amber-50/30 text-center py-12">
          <CardContent className="space-y-6">
            <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <Hammer className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">อยู่ระหว่างการปรับปรุง</h2>
              <p className="text-slate-600 font-medium">
                ขออภัยในความไม่สะดวก
              </p>
            </div>
            <Link 
              href="/" 
              className={cn(
                buttonVariants({ variant: "default" }), 
                "bg-blue-600 hover:bg-blue-700 flex items-center justify-center w-full"
              )}
            >
              <Home className="w-4 h-4 mr-2" />
              <span>กลับหน้าหลัก</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
