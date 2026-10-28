"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, BadgeCheck, Info, KeyRound } from "lucide-react";
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
  thaid_init_failed: "ไม่สามารถเริ่มต้นการเข้าสู่ระบบ ThaiD ได้",
  thaid_not_configured: "ยังไม่ได้ตั้งค่า THAID_ สำหรับระบบ ThaiD",
  thaid_state_mismatch: "ข้อมูลยืนยันความปลอดภัยของ ThaiD ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
  thaid_user_not_registered: "ไม่พบบัญชีผู้ใช้จาก ThaiD กรุณาเข้าสู่ระบบผ่าน MOPH ProviderID เพื่อลงทะเบียนก่อน",
};

function subscribeToLocationChange() {
  return () => { };
}

function getLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return "";
}

export default function LoginPage() {
  const router = useRouter();
  const { data: settings } = trpc.systemSetting.getPublicSettings.useQuery();
  const locationSearch = useSyncExternalStore(
    subscribeToLocationChange,
    getLocationSearch,
    getServerLocationSearch,
  );
  const params = new URLSearchParams(locationSearch);
  const urlError = params.get("error");
  const hasAuthorizationCode = params.has("code");
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessingSSO, setIsProcessingSSO] = useState(false);
  const displayErrorMessage =
    errorMessage ||
    (urlError
      ? SSO_ERROR_MESSAGES[urlError] ?? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง"
      : "");

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const code = params.get("code");
    const callbackUrl = params.get("callbackUrl") || "/";
    const provider = params.get("provider") === "thaid" ? "thaid-sso" : "moph-sso";
    const thaidRedirectUri = params.get("thaidRedirectUri") || "";

    if (!code) {
      return;
    }

    void signIn(provider, {
      code,
      redirectUri: thaidRedirectUri,
      callbackUrl,
      redirect: false,
    }).then((result) => {
      if (result?.error) {
        const nextError = SSO_ERROR_MESSAGES[result.error] ?? "ไม่สามารถยืนยันตัวตนผ่าน SSO ได้";
        setErrorMessage(nextError);
        setIsProcessingSSO(false);
        router.replace(`/login?error=${encodeURIComponent(result.error)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
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
      router.replace(`/login?error=${encodeURIComponent("CredentialsSignin")}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    });
  }, [locationSearch, router]);



  const handleMOPHLogin = () => {
    setErrorMessage("");
    setIsProcessingSSO(true);
    window.location.href = "/api/auth/moph/init?callbackUrl=%2F";
  };

  const handleThaiDLogin = () => {
    setErrorMessage("");
    setIsProcessingSSO(true);
    window.location.href = "/api/auth/thaid/init?callbackUrl=%2F";
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#f6f8f7] p-4 md:p-8">
      <div className="z-10 w-full max-w-5xl">
        <Card className="border border-slate-200/80 shadow-xl bg-white overflow-hidden rounded-lg flex flex-col md:flex-row gap-0 p-0">
          <div className="w-full md:w-1/2 bg-emerald-700 p-8 md:p-12 flex flex-col justify-center items-center text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(135deg,rgba(255,255,255,.32)_1px,transparent_1px)] [background-size:18px_18px]" />

            <div className="relative z-10 flex flex-col items-center text-center space-y-7">
              <div className="p-5 bg-white rounded-lg shadow-lg ring-1 ring-white/30">
                <Image src={logo} alt="Logo" width={132} height={132} priority className="object-contain" />
              </div>
              <div className="space-y-3">
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">
                  {settings?.sys_name || APP_CONFIG.name}
                </h1>
                <p className="text-emerald-50 text-base md:text-lg font-medium px-2">
                  {settings?.sys_description || APP_CONFIG.description}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center bg-white">
            <div className="space-y-7 w-full max-w-md mx-auto">
              <div className="space-y-2 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-950">
                  เข้าสู่ระบบ
                </h2>
                <p className="text-slate-500 font-medium">เลือกช่องทางยืนยันตัวตนเพื่อเข้าใช้งานระบบ</p>
              </div>

              <div className="space-y-5">
                {displayErrorMessage ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                    {displayErrorMessage}
                  </div>
                ) : null}

                {isProcessingSSO || hasAuthorizationCode ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center justify-center gap-3 font-medium shadow-sm">
                    <div className="size-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                    กำลังตรวจสอบข้อมูล...
                  </div>
                ) : null}

                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 shadow-sm">
                  <Info className="size-5 mt-0.5 shrink-0 text-blue-500" />
                  <div className="text-sm leading-relaxed">
                    <p className="font-bold">ใช้งานระบบครั้งแรก?</p>
                    <p>
                      กรุณาเข้าสู่ระบบด้วย <span className="font-semibold">MOPH ProviderID</span> เพื่อลงทะเบียนก่อน
                      หลังจากนั้นจึงเข้าสู่ระบบด้วย ThaiD ได้
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-4.5 shadow-md shadow-emerald-500/10 transition-all hover:border-emerald-500/60">
                    <div className="mb-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-sm shadow-emerald-500/30">
                          <KeyRound className="size-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-950">
                            ลงทะเบียน / เข้าสู่ระบบด้วย MOPH ProviderID
                          </h3>
                          <p className="text-xs text-slate-500">สำหรับบุคลากรสาธารณสุข กระทรวงสาธารณสุข</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleMOPHLogin}
                      disabled={isProcessingSSO}
                      className="group w-full h-12 justify-between rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-4 text-base font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-teal-800 hover:shadow-lg hover:shadow-emerald-600/35 active:scale-[0.99]"
                    >
                      <span>เข้าสู่ระบบด้วย MOPH ProviderID</span>
                      <ArrowRight className="size-5 text-emerald-100 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>

                  <div className="rounded-xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/50 p-4.5 shadow-md shadow-blue-500/10 transition-all hover:border-blue-500/60">
                    <div className="mb-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white shadow-sm shadow-blue-500/30">
                          <BadgeCheck className="size-5" />
                        </div>
                        <div>

                          <h3 className="text-base font-bold text-slate-950">
                            เข้าสู่ระบบด้วย ThaiD
                          </h3>

                          <p className="text-xs text-slate-500">สแกน QR Code ผ่านแอปพลิเคชัน ThaiD</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={handleThaiDLogin}
                      disabled={isProcessingSSO}
                      className="group w-full h-12 justify-between rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-base font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-600/35 active:scale-[0.99]"
                    >
                      <span>เข้าสู่ระบบด้วย ThaiD</span>
                      <ArrowRight className="size-5 text-blue-100 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <p className="text-center text-sm font-medium text-slate-500 mt-8">
          สงวนลิขสิทธิ์ &copy; {new Date().getFullYear()} สำนักงานสาธารณสุขจังหวัดพิษณุโลก
        </p>
      </div>
    </div>
  );
}
