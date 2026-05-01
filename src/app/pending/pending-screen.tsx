"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG } from "@/lib/constants";

type PendingScreenProps = {
  initialName: string;
};

type MeResponse = {
  user?: {
    status?: string;
  };
};

const POLLING_INTERVAL_MS = 30 * 1000;

export function PendingScreen({ initialName }: PendingScreenProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("ระบบจะตรวจสอบสถานะให้โดยอัตโนมัติทุก 30 วินาที");
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (!isMounted) return;

      setIsChecking(true);

      try {
        const response = await fetch("/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("status_check_failed");
        }

        const data = (await response.json()) as MeResponse;
        const latestStatus = data.user?.status;

        if (latestStatus === "active") {
          setStatusMessage("บัญชีได้รับการอนุมัติแล้ว กำลังพาเข้าสู่ระบบ...");
          router.replace("/");
          router.refresh();
          return;
        }

        setStatusMessage("บัญชีของคุณยังอยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ");
      } catch {
        if (isMounted) {
          setStatusMessage("ยังไม่สามารถตรวจสอบสถานะล่าสุดได้ ระบบจะลองใหม่อัตโนมัติ");
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    void checkStatus();
    const intervalId = window.setInterval(() => {
      void checkStatus();
    }, POLLING_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(14,116,144,0.16),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#ecfeff_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <Card className="w-full max-w-2xl border-0 bg-white/80 shadow-2xl ring-1 ring-slate-200 backdrop-blur">
          <CardHeader className="space-y-4 pb-4 text-center">
            <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 shadow-sm">
              <ShieldAlert className="h-9 w-9" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">
                รอการอนุมัติจากผู้ดูแลระบบ
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                {APP_CONFIG.name}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <p className="text-lg font-semibold text-slate-900">{initialName}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                บัญชีของคุณถูกสร้างเรียบร้อยแล้ว แต่ยังไม่สามารถเข้าใช้งานระบบหลักได้
                จนกว่าผู้ดูแลระบบจะเปลี่ยนสถานะเป็นใช้งาน
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock3 className="h-4 w-4 text-amber-600" />
                  สถานะปัจจุบัน
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{statusMessage}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="min-w-44 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                ออกจากระบบ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
