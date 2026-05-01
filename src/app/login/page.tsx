"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogIn, KeyRound } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";
import { trpc } from "@/trpc/client";
import Image from "next/image";
import logo from "./logo.png";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "การเข้าสู่ระบบถูกยกเลิกจากระบบ SSO",
  CredentialsSignin: "ไม่สามารถเข้าสู่ระบบด้วย MOPH ProviderID ได้ กรุณาลองใหม่อีกครั้ง",
  missing_code: "ระบบไม่ได้รับรหัสยืนยันจาก MOPH SSO",
  sso_init_failed: "ไม่สามารถเริ่มต้นการเข้าสู่ระบบ SSO ได้",
  sso_not_configured: "ยังไม่ได้ตั้งค่า HEALTH_/PROVIDER_ สำหรับระบบ SSO",
  registration_disabled: "ระบบยังไม่เปิดรับการลงทะเบียนใหม่ในขณะนี้ กรุณาติดต่อผู้ดูแลระบบ",
};

export default function LoginPage() {
  const router = useRouter();
  const initialParams =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const initialCode = initialParams?.get("code");
  const initialCallbackUrl = initialParams?.get("callbackUrl") || "/";
  const initialError = initialParams?.get("error");
  
  const { data: settings } = trpc.systemSetting.getPublicSettings.useQuery();
  
  const [errorMessage, setErrorMessage] = useState(
    initialError
      ? (SSO_ERROR_MESSAGES[initialError] ?? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง")
      : "",
  );
  const [isProcessingSSO, setIsProcessingSSO] = useState(Boolean(initialCode));

  useEffect(() => {
    if (!initialCode) {
      return;
    }

    void signIn("moph-sso", {
      code: initialCode,
      callbackUrl: initialCallbackUrl,
      redirect: false,
    }).then((result) => {
      if (result?.error) {
        const nextError = SSO_ERROR_MESSAGES[result.error] ?? "ไม่สามารถยืนยันตัวตนผ่าน SSO ได้";
        setErrorMessage(nextError);
        setIsProcessingSSO(false);
        router.replace(`/login?error=${encodeURIComponent(result.error)}&callbackUrl=${encodeURIComponent(initialCallbackUrl)}`);
        return;
      }

      if (result?.url) {
        window.location.href = result.url;
        return;
      }

      setIsProcessingSSO(false);
    }).catch(() => {
      setErrorMessage("เกิดข้อผิดพลาดระหว่างเชื่อมต่อระบบ SSO");
      setIsProcessingSSO(false);
      router.replace(`/login?error=${encodeURIComponent("CredentialsSignin")}&callbackUrl=${encodeURIComponent(initialCallbackUrl)}`);
    });
  }, [initialCallbackUrl, initialCode, router]);



  const handleMOPHLogin = () => {
    setErrorMessage("");
    setIsProcessingSSO(true);
    window.location.href = "/api/auth/moph/init?callbackUrl=%2F";
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">
      {/* Decorative background shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/20 blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-md px-4">
        <Card className="border-0 shadow-2xl bg-white/70 backdrop-blur-xl ring-1 ring-white/50">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="flex justify-center mb-2">
              <Image src={logo} alt="Logo" width={112} height={112} className="object-contain drop-shadow-2xl" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              {settings?.sys_name || APP_CONFIG.name}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {settings?.sys_description || APP_CONFIG.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {isProcessingSSO ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                กำลังยืนยันตัวตนกับ MOPH ProviderID...
              </div>
            ) : null}
            
            <div className="space-y-4">
              <Button
                onClick={handleMOPHLogin}
                disabled={isProcessingSSO}
                className="w-full h-12 text-base font-medium shadow-md transition-all hover:scale-[1.02] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <KeyRound className="w-5 h-5 mr-2" />
                เข้าสู่ระบบด้วย MOPH ProviderID
              </Button>
            </div>


          </CardContent>
        </Card>
        
        <p className="text-center text-sm text-slate-500 mt-8">
          สงวนลิขสิทธิ์ &copy; {new Date().getFullYear()} สำนักงานสาธารณสุขจังหวัดพิษณุโลก
        </p>
      </div>
    </div>
  );
}
