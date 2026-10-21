"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { startOfDay } from "date-fns";
import { MapPin, Clock, Camera, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { formatWorkedDuration, getWorkProgress, isManualLocationAllowed } from "@/lib/attendance-utils";
import { DAY_PERIOD_LABELS, EXCEPTION_TYPE_LABELS } from "@/lib/attendance-exception";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LocationMap = dynamic(
  () => import("@/components/attendance/location-map"),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse bg-slate-100 rounded-md" /> }
);
import { cn } from "@/lib/utils";

// Office Location Constants
const OFFICE_LAT = 16.8173716;
const OFFICE_LNG = 100.2584649;
const DEFAULT_OFFICE_RADIUS = 100;

// Haversine formula to calculate distance in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

type WorkType = "wfh" | "office" | "official_trip" | "onsite";

export function AttendanceCard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workType, setWorkType] = useState<WorkType>("office");
  const [tasks, setTasks] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.attendance.getTodayStatus.useQuery();
  const { data: wfhRequests, isLoading: isWfhLoading } = trpc.wfh.getUserRequests.useQuery();
  const { data: settings } = trpc.systemSetting.getAll.useQuery();
  const { data: todayException } = trpc.attendanceException.getTodayApproved.useQuery();

  const OFFICE_RADIUS_METERS = useMemo(() => {
    if (settings?.office_radius) {
      const val = parseInt(settings.office_radius);
      return isNaN(val) ? DEFAULT_OFFICE_RADIUS : val;
    }
    return DEFAULT_OFFICE_RADIUS;
  }, [settings]);

  const OFFICE_COORDS = useMemo(() => ({
    lat: settings?.office_lat ? parseFloat(settings.office_lat) : OFFICE_LAT,
    lng: settings?.office_lng ? parseFloat(settings.office_lng) : OFFICE_LNG
  }), [settings]);

  const allowManualLocation = isManualLocationAllowed(settings?.allow_manual_location);
  
  // ใช้ useMemo เพื่อป้องกันการสร้าง Date ใหม่ทุกครั้งที่เรนเดอร์ (แก้ปัญหาลูป)
  const today = useMemo(() => startOfDay(new Date()), []);
  const { data: weeklyPlan, isLoading: isPlanLoading } = trpc.weeklyPlan.getPlan.useQuery({ date: today });

  const todayPlan = useMemo(() => {
    if (!weeklyPlan?.plan_data) {
      console.log("Weekly Plan Data not found", { weeklyPlan });
      return null;
    }
    
    // บังคับ locale enUS เพื่อให้ได้ชื่อวันภาษาอังกฤษตัวเล็กตรงกับคีย์ใน DB
    const todayName = format(today, "EEEE", { locale: enUS }).toLowerCase();
    const planObject = weeklyPlan.plan_data as Record<string, string>;
    const plan = planObject[todayName] || null;
    
    console.log("Plan for today:", { todayName, plan, allPlan: planObject });
    return plan;
  }, [weeklyPlan, today]);

  const hasApprovedWfhToday = wfhRequests?.some(req => {
    // ปรับวันนี้เป็นเที่ยงวันเพื่อความแม่นยำในการเทียบช่วงวันที่
    const todayForCheck = new Date();
    todayForCheck.setHours(12, 0, 0, 0);
    
    const start = new Date(req.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(req.end_date);
    end.setHours(23, 59, 59, 999);
    return req.status === "approved" && todayForCheck >= start && todayForCheck <= end;
  });

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: () => {
      toast.success("ลงเวลาเข้างานสำเร็จ");
      utils.attendance.getTodayStatus.invalidate();
      utils.attendance.getHistory.invalidate();
      utils.dashboard.getStats.invalidate();
      utils.dashboard.getRecentActivities.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const checkOutMutation = trpc.attendance.checkOut.useMutation({
    onSuccess: () => {
      toast.success("ลงเวลาออกงานสำเร็จ");
      utils.attendance.getTodayStatus.invalidate();
      utils.attendance.getHistory.invalidate();
      utils.dashboard.getStats.invalidate();
      utils.dashboard.getRecentActivities.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    // ดึงพิกัดอัตโนมัติเมื่อเปิดหน้า
    fetchLocation();
    return () => clearInterval(timer);
  }, []);

  const distance = useMemo(() => {
    if (!location) return null;
    return calculateDistance(location.lat, location.lng, OFFICE_COORDS.lat, OFFICE_COORDS.lng);
  }, [location, OFFICE_COORDS]);

  const isInArea = useMemo(() => {
    if (distance === null) return false;
    return distance <= OFFICE_RADIUS_METERS;
  }, [distance, OFFICE_RADIUS_METERS]);

  const fetchLocation = (onSuccess?: (loc: { lat: number; lng: number }) => void) => {
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      toast.error("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด");
      setIsGettingLocation(false);
      return;
    }

    const options: PositionOptions = { 
      enableHighAccuracy: true, 
      timeout: 10000,
      maximumAge: 0 
    };

    const handleSuccess = (position: GeolocationPosition) => {
      const newLoc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setLocation(newLoc);
      setIsGettingLocation(false);
      if (onSuccess) onSuccess(newLoc);
    };

    const handleError = (error: GeolocationPositionError) => {
      // หาก High Accuracy ล้มเหลว (Code 2: Unavailable หรือ Code 3: Timeout) ให้ลองแบบธรรมดา
      if (options.enableHighAccuracy && (error.code === 2 || error.code === 3)) {
        console.log("High accuracy failed, retrying with normal accuracy...");
        navigator.geolocation.getCurrentPosition(handleSuccess, handleFinalError, {
          ...options,
          enableHighAccuracy: false,
          timeout: 15000
        });
      } else {
        handleFinalError(error);
      }
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      console.error(error);
      if (error.code === error.PERMISSION_DENIED) {
        toast.error("คุณปฏิเสธการเข้าถึงตำแหน่ง กรุณาเปิดสิทธิ์ในตั้งค่าเบราว์เซอร์");
      } else {
        toast.error("ไม่สามารถดึงพิกัดได้: " + error.message);
      }
      setIsGettingLocation(false);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
  };

  const requestPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (result.state === 'denied') {
          toast.info("กรุณาเปลี่ยนการตั้งค่าสิทธิ์ 'ตำแหน่ง' ในเบราว์เซอร์ของคุณ (คลิกที่ไอคอนแม่กุญแจข้าง URL)");
        } else {
          fetchLocation();
        }
      } else {
        fetchLocation();
      }
    } catch (e) {
      fetchLocation();
    }
  };

  const handleOpenMap = () => {
    if (!allowManualLocation) return;
    setIsMapOpen(true);
    if (!location) {
      fetchLocation();
    }
  };

  const handleCheckIn = async () => {
    if (!location) {
      fetchLocation((newLoc) => {
        checkInMutation.mutate({ workType, lat: newLoc.lat, lng: newLoc.lng });
      });
      return;
    }
    checkInMutation.mutate({ workType, lat: location.lat, lng: location.lng });
  };

  const handleCheckOut = async () => {
    if (!tasks || tasks.trim() === "") {
      toast.error("กรุณาระบุสรุปงานที่ทำในวันนี้ก่อนลงเวลาออก");
      return;
    }

    if (!location) {
      fetchLocation((newLoc) => {
        checkOutMutation.mutate({ tasks, lat: newLoc.lat, lng: newLoc.lng });
      });
      return;
    }
    checkOutMutation.mutate({ tasks, lat: location.lat, lng: location.lng });
  };

  if (isLoading || isWfhLoading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  const isCheckedIn = !!status?.check_in_time;
  const isCheckedOut = !!status?.check_out_time;
  const workProgress = status?.check_in_time
    ? getWorkProgress(new Date(status.check_in_time), currentTime, {
        workingTime: settings?.working_time,
        afternoonStart: settings?.afternoon_start_time,
        exceptionPeriod: todayException?.period,
      })
    : null;

  const workTypes: { id: WorkType; label: string; thLabel: string; icon: React.ReactNode; color: string; idleColor: string; iconBg: string }[] = [
    { id: "office", label: "Office", thLabel: "(เข้าสำนักงาน)", icon: <Clock className="w-5 h-5" />, color: "border-blue-500 text-blue-600 bg-blue-50", idleColor: "border-blue-200 text-blue-600 bg-white hover:border-blue-400 hover:bg-blue-50/60", iconBg: "bg-blue-50" },
    { id: "onsite", label: "Onsite", thLabel: "(ลงพื้นที่)", icon: <MapPin className="w-5 h-5" />, color: "border-orange-500 text-orange-600 bg-orange-50", idleColor: "border-orange-200 text-orange-600 bg-white hover:border-orange-400 hover:bg-orange-50/60", iconBg: "bg-orange-50" },
    { id: "wfh", label: "WFH", thLabel: "(ปฏิบัติงานที่บ้าน)", icon: <MapPin className="w-5 h-5" />, color: "border-purple-500 text-purple-600 bg-purple-50", idleColor: "border-purple-200 text-purple-600 bg-white hover:border-purple-400 hover:bg-purple-50/60", iconBg: "bg-purple-50" },
  ];

  return (
    <>
      <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 p-8 text-white relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h2 className="text-3xl font-black tracking-tight mb-1">ระบบลงเวลา</h2>
              <p className="text-blue-100 font-medium">
                {format(currentTime, "EEEEที่ d MMMM yyyy", { locale: th })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-mono font-black mb-2 drop-shadow-md">
                {format(currentTime, "HH:mm:ss")}
              </div>
              <Badge className={cn(
                "px-3 py-1 text-sm font-bold border-none shadow-sm",
                isCheckedIn ? (isCheckedOut ? "bg-slate-500" : "bg-emerald-500") : "bg-amber-500"
              )}>
                {isCheckedIn ? (isCheckedOut ? "ออกงานแล้ว" : "เข้างานแล้ว") : "รอลงเวลา"}
              </Badge>
            </div>
          </div>
        </div>

        <CardContent className="p-8 space-y-8 bg-white">
          {todayException ? (
            <div className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-sm",
              todayException.period === "full" ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-amber-200 bg-amber-50 text-amber-800"
            )}>
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">
                  วันนี้ได้รับอนุมัติ{todayException.types.map((type) => EXCEPTION_TYPE_LABELS[type]).join(" / ")} {DAY_PERIOD_LABELS[todayException.period]}
                </p>
                <p>
                  {todayException.period === "full"
                    ? "ไม่ต้องลงเวลาปฏิบัติงานในวันนี้"
                    : "ช่วงเวลาที่เหลือยังต้องลงเวลาปฏิบัติงานตามปกติ"}
                </p>
              </div>
            </div>
          ) : null}
          {todayException?.period === "full" && !isCheckedIn ? null : !isCheckedIn ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-600 rounded-full" />
                  เลือกประเภทการปฏิบัติงาน
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  {workTypes.map((type) => {
                    const isDisabled = type.id === "wfh" && !hasApprovedWfhToday;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          if (isDisabled) {
                            toast.error("คุณไม่สามารถเลือกลงเวลาแบบ WFH ได้ เนื่องจากไม่มีคำขอที่ได้รับการอนุมัติในวันนี้");
                            return;
                          }
                          setWorkType(type.id);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 gap-2 group relative",
                          isDisabled
                            ? "border-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                            : workType === type.id
                              ? `${type.color} shadow-md scale-105`
                              : `${type.idleColor} shadow-sm`
                        )}
                      >
                        <div className={cn(
                          "p-3 rounded-xl transition-colors",
                          isDisabled
                            ? "bg-slate-100"
                            : workType === type.id ? "bg-white shadow-sm" : type.iconBg
                        )}>
                          {type.icon}
                        </div>
                        <div className="flex flex-col items-center leading-tight">
                          <span className="font-bold text-sm">{type.label}</span>
                          <span className="text-[11px] opacity-75">{type.thLabel}</span>
                        </div>
                        {isDisabled && (
                          <span className="text-[10px] text-red-500 font-medium whitespace-nowrap mt-1">
                            ยังไม่อนุมัติ WFH
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className={cn(
                  "flex flex-col gap-3 p-4 rounded-2xl border transition-all",
                  location ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                )}>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl transition-colors",
                          location 
                            ? (workType === "office" 
                                ? (isInArea ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600") 
                                : "bg-emerald-100 text-emerald-600")
                            : "bg-amber-100 text-amber-600 animate-pulse"
                        )}>
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                            {location 
                              ? (workType === "office"
                                  ? (isInArea ? "อยู่ในพื้นที่สำนักงาน" : "อยู่นอกพื้นที่สำนักงาน")
                                  : "ระบุพิกัดปัจจุบันแล้ว")
                              : (isGettingLocation ? "กำลังดึงพิกัด..." : "ยังไม่พบพิกัด")}
                            {location && workType === "office" && (
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                isInArea ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                              )}>
                                {Math.round(distance || 0)} ม.
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                            {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "กรุณาคลิกเพื่อดึงพิกัดล่าสุด"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {allowManualLocation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-blue-600 font-bold hover:bg-blue-50 rounded-lg text-[11px]"
                            onClick={handleOpenMap}
                          >
                            อัปเดต
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg text-[11px]"
                          onClick={() => fetchLocation()}
                          disabled={isGettingLocation}
                        >
                          {isGettingLocation ? "..." : "รีโหลด"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-amber-600 font-bold hover:bg-amber-50 rounded-lg text-[11px]"
                          onClick={requestPermission}
                        >
                          ขอสิทธิ์ GPS
                        </Button>
                      </div>
                    </div>

                    {location && workType === "office" && !isInArea && (
                      <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800">
                        <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                        <div className="text-xs leading-relaxed">
                          <p className="font-bold">หากคุณอยู่ที่สำนักงานแล้ว แต่ระบบแสดงว่าอยู่นอกพื้นที่</p>
                          <p>ให้ปิดการใช้งาน Wi-Fi และตรวจสอบว่าได้เปิด GPS (ตำแหน่ง) ในสมาร์ทโฟนแล้ว จากนั้นกด &quot;รีโหลด&quot; เพื่อดึงพิกัดใหม่</p>
                        </div>
                      </div>
                    )}

                    {location && (
                      <div className="rounded-2xl overflow-hidden shadow-inner border border-slate-100 z-0 h-[280px]">
                        <LocationMap 
                          initialLocation={location} 
                          readOnly={true} 
                          distance={distance || 0}
                          isInArea={isInArea}
                          radius={OFFICE_RADIUS_METERS}
                          officeLat={OFFICE_COORDS.lat}
                          officeLng={OFFICE_COORDS.lng}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  size="lg"
                  className={cn(
                    "w-full py-9 text-xl font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] border-b-4",
                    isInArea 
                      ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-800 text-white shadow-emerald-100" 
                      : "bg-blue-600 hover:bg-blue-700 border-blue-800 text-white shadow-blue-100"
                  )}
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending || isGettingLocation}
                >
                  {isGettingLocation ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังดึงพิกัด...
                    </div>
                  ) : checkInMutation.isPending ? (
                    "กำลังบันทึก..."
                  ) : (
                    "ลงเวลาเข้างาน"
                  )}
                </Button>
              </div>
            </div>
          ) : !isCheckedOut ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">เวลาเข้างาน</p>
                    <p className="text-xl font-black text-blue-900">
                      {format(new Date(status.check_in_time!), "HH:mm น.")}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">ประเภทงาน</p>
                    <p className="text-xl font-black text-indigo-900 capitalize">
                      {status.work_type === 'wfh' ? 'WFH' : status.work_type}
                    </p>
                  </div>
                </div>
              </div>

              {workProgress && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm text-slate-600">ทำงานมาแล้ว</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {formatWorkedDuration(workProgress.workedMinutes)}
                    </p>
                  </div>
                  <div
                    className="h-2.5 rounded-full bg-slate-200 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(workProgress.percent)}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-[width] duration-700"
                      style={{ width: `${workProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>เข้างาน {format(new Date(status!.check_in_time!), "HH:mm น.")}</span>
                    <span>ครบ {workProgress.requiredHours} ชม. เวลา {format(workProgress.endTime, "HH:mm น.")}</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-bold text-slate-800">
                    สรุปงานที่ทำในวันนี้ <span className="text-rose-500">*</span>
                  </Label>
                  {todayPlan && tasks !== todayPlan && (
                    <button
                      type="button"
                      onClick={() => setTasks(todayPlan)}
                      className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors font-medium shadow-sm"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      ดึงจากแผนงานวันนี้
                    </button>
                  )}
                </div>
                <Textarea
                  placeholder="ระบุงานที่ทำเสร็จ หรือความคืบหน้า..."
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  className="min-h-[120px] rounded-2xl border-slate-200 focus:ring-blue-500 transition-all p-4 text-base shadow-inner bg-slate-50/30"
                />
              </div>

              <div className="flex flex-col gap-4">
                <div className={cn(
                  "flex flex-col gap-3 p-4 rounded-2xl border transition-all",
                  location ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        location ? "bg-emerald-200 text-emerald-700" : "bg-amber-200 text-amber-700 animate-pulse"
                      )}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          {location ? "ระบุตำแหน่งสำเร็จ" : isGettingLocation ? "กำลังดึงพิกัด..." : "ยังไม่มีข้อมูลพิกัด"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "กรุณาอนุญาตการเข้าถึงตำแหน่ง"}
                        </p>
                      </div>
                    </div>
                    {allowManualLocation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 font-bold hover:bg-blue-50"
                        onClick={handleOpenMap}
                      >
                        อัปเดต
                      </Button>
                    )}
                  </div>
                  {location && (
                    <div className="mt-1 rounded-xl overflow-hidden shadow-sm border border-emerald-200/60 z-0">
                      <LocationMap initialLocation={location} readOnly={true} />
                    </div>
                  )}
                </div>

                <Button
                  size="lg"
                  className="w-full py-8 text-xl font-black rounded-2xl shadow-lg bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all"
                  onClick={handleCheckOut}
                  disabled={checkOutMutation.isPending || isGettingLocation}
                >
                  {isGettingLocation ? "กำลังดึงพิกัด..." : checkOutMutation.isPending ? "กำลังบันทึก..." : "ลงเวลาออกงาน"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 mb-2 shadow-inner">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900">คุณลงเวลาปฏิบัติงานเรียบร้อยแล้ว</h3>
                <p className="text-slate-500 font-medium">ขอบคุณสำหรับการทำงานในวันนี้</p>
              </div>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">เข้างาน</p>
                  <p className="text-xl font-black text-slate-900">{format(new Date(status.check_in_time!), "HH:mm น.")}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">ออกงาน</p>
                  <p className="text-xl font-black text-slate-900">{format(new Date(status.check_out_time!), "HH:mm น.")}</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span>* กรุณาตรวจสอบและระบุตำแหน่งพิกัดของท่านให้ถูกต้องก่อนทำการลงเวลาทุกครั้ง</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ระบุตำแหน่ง</DialogTitle>
            <DialogDescription>
              คลิกหรือเลื่อนแผนที่เพื่อปักหมุดตำแหน่งปัจจุบันของคุณ
            </DialogDescription>
          </DialogHeader>
          {isMapOpen && (
            <LocationMap
              initialLocation={location}
              officeLat={OFFICE_COORDS.lat}
              officeLng={OFFICE_COORDS.lng}
              radius={OFFICE_RADIUS_METERS}
              onConfirm={(loc) => {
                setLocation(loc);
                setIsMapOpen(false);
                toast.success("ปักหมุดตำแหน่งสำเร็จ");
              }}
              onCancel={() => setIsMapOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
