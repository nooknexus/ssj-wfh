"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/trpc/client";
import { format, startOfWeek, addDays } from "date-fns";
import { th } from "date-fns/locale";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { ModuleGuard } from "@/components/layout/module-guard";

export default function WeeklyPlanPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [planData, setPlanData] = useState<Record<string, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
  });

  const { data: weeklyPlan, isLoading } = trpc.weeklyPlan.getPlan.useQuery({ date: currentDate });
  
  const utils = trpc.useUtils();
  const saveMutation = trpc.weeklyPlan.savePlan.useMutation({
    onSuccess: () => {
      toast.success("บันทึกแผนงานสำเร็จ");
      utils.weeklyPlan.getPlan.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (weeklyPlan && weeklyPlan.plan_data) {
      setPlanData(weeklyPlan.plan_data as Record<string, string>);
    } else {
      setPlanData({
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
      });
    }
  }, [weeklyPlan]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = [
    { key: "monday", label: "วันจันทร์", date: addDays(weekStart, 1) },
    { key: "tuesday", label: "วันอังคาร", date: addDays(weekStart, 2) },
    { key: "wednesday", label: "วันพุธ", date: addDays(weekStart, 3) },
    { key: "thursday", label: "วันพฤหัสบดี", date: addDays(weekStart, 4) },
    { key: "friday", label: "วันศุกร์", date: addDays(weekStart, 5) },
  ];

  const handleSave = () => {
    saveMutation.mutate({
      date: currentDate,
      planData,
    });
  };

  const handleTextChange = (key: string, value: string) => {
    setPlanData(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <ModuleGuard moduleKey="module_weekly_plan">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* ... existing content ... */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">แผนงานล่วงหน้ารายสัปดาห์</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4"/> 
              สัปดาห์ที่ {format(weekStart, "d MMM", { locale: th })} - {format(addDays(weekStart, 4), "d MMM yyyy", { locale: th })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentDate(addDays(currentDate, -7))}>สัปดาห์ก่อนหน้า</Button>
            <Button variant="outline" onClick={() => setCurrentDate(new Date())}>สัปดาห์นี้</Button>
            <Button variant="outline" onClick={() => setCurrentDate(addDays(currentDate, 7))}>สัปดาห์ถัดไป</Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">รายละเอียดแผนงาน</CardTitle>
              <CardDescription>ระบุแผนงานหรือเป้าหมายที่คาดว่าจะดำเนินการในแต่ละวัน</CardDescription>
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2"/>
              {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {weekDays.map((day) => (
              <div key={day.key} className="space-y-2">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>{day.label}</span>
                  <span className="text-sm font-normal text-slate-500">{format(day.date, "d MMMM yyyy", { locale: th })}</span>
                </label>
                <Textarea 
                  placeholder={`ระบุแผนงานสำหรับ${day.label}...`}
                  className="min-h-[80px] rounded-xl border-slate-200 focus:ring-blue-500 transition-all text-sm"
                  value={planData[day.key] || ""}
                  onChange={(e) => handleTextChange(day.key, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ModuleGuard>
  );
}
