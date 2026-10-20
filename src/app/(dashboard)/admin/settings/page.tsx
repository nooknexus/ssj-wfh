"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Globe, Lock, ShieldCheck, LayoutGrid, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useEffect } from "react";

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();

  const { data: settings, isLoading } = trpc.systemSetting.getAll.useQuery();
  const updateMutation = trpc.systemSetting.update.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเรียบร้อยแล้ว");
      utils.systemSetting.getAll.invalidate();
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key: string) => {
    const currentValue = formData[key] === "true";
    setFormData((prev) => ({ ...prev, [key]: (!currentValue).toString() }));
  };

  const handleSave = () => {
    updateMutation.mutate({ settings: formData });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ตั้งค่าระบบ
        </h1>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2"/>
          {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่าทั้งหมด"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600"/>
              <CardTitle>ข้อมูลพื้นฐาน</CardTitle>
            </div>
            <CardDescription>ตั้งชื่อระบบและข้อมูลทั่วไป</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sys_name">ชื่อระบบ</Label>
              <Input 
                id="sys_name" 
                value={formData.sys_name || ""} 
                onChange={(e) => handleChange("sys_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_name">ชื่อหน่วยงาน</Label>
              <Input 
                id="org_name" 
                value={formData.org_name || ""} 
                onChange={(e) => handleChange("org_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office_radius">รัศมีสำนักงาน (เมตร)</Label>
              <Input 
                id="office_radius" 
                type="number"
                placeholder="เช่น 100"
                value={formData.office_radius || "100"} 
                onChange={(e) => handleChange("office_radius", e.target.value)}
              />
              <p className="text-[10px] text-slate-500">ระยะห่างสูงสุดจากสำนักงาน (เมตร) ที่จะถือว่า "อยู่ในพื้นที่"</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="afternoon_start_time">เวลาเริ่มงานช่วงบ่าย</Label>
              <Input
                id="afternoon_start_time"
                type="time"
                value={formData.afternoon_start_time || "13:00"}
                onChange={(e) => handleChange("afternoon_start_time", e.target.value)}
              />
              <p className="text-[10px] text-slate-500">ใช้นับเวลาสายเมื่อได้รับอนุมัติลาหรือไปราชการครึ่งเช้า</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="office_lat">พิกัดละติจูด (Latitude)</Label>
                <Input 
                  id="office_lat" 
                  placeholder="เช่น 16.8173716"
                  value={formData.office_lat || "16.8173716"} 
                  onChange={(e) => handleChange("office_lat", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office_lng">พิกัดลองจิจูด (Longitude)</Label>
                <Input 
                  id="office_lng" 
                  placeholder="เช่น 100.2584649"
                  value={formData.office_lng || "100.2584649"} 
                  onChange={(e) => handleChange("office_lng", e.target.value)}
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-0.5 pr-3">
                  <Label htmlFor="allow_manual_location" className="font-medium text-slate-800 text-sm cursor-pointer">
                    การปักพิกัดแบบแมนนวล (ปุ่มอัปเดต)
                  </Label>
                  <p className="text-xs text-slate-500">
                    แสดงปุ่ม &quot;อัปเดต&quot; ให้ผู้ใช้เปิดแผนที่เพื่อปักหมุดพิกัดเองได้ตอนลงเวลางาน (หากปิด ผู้ใช้จะลงเวลาด้วยพิกัด GPS อัตโนมัติเท่านั้น)
                  </p>
                </div>
                <Switch 
                  id="allow_manual_location"
                  checked={formData.allow_manual_location !== "false"} 
                  onCheckedChange={() => handleToggle("allow_manual_location")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-purple-600"/>
              <CardTitle>การเปิด-ปิด โมดูล</CardTitle>
            </div>
            <CardDescription>เลือกโมดูลที่ต้องการแสดงบนเมนู</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "module_attendance", label: "ระบบลงเวลาปฏิบัติงาน" },
              { key: "module_weekly_plan", label: "แผนงานล่วงหน้ารายสัปดาห์" },
              { key: "module_leave", label: "ระบบลาออนไลน์" },
              { key: "module_meeting", label: "ระบบจอง Web Conference" },
              { key: "module_document", label: "ระบบงานสารบรรณกลุ่มงาน" },
            ].map((module) => (
              <div key={module.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-medium text-slate-700">{module.label}</span>
                <Switch 
                  checked={formData[module.key] === "true"} 
                  onCheckedChange={() => handleToggle(module.key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600"/>
              <CardTitle>การเข้าถึงและสิทธิ์</CardTitle>
            </div>
            <CardDescription>จัดการสิทธิ์การเข้าถึงพื้นฐาน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="font-medium text-slate-900">เปิดรับการลงทะเบียนใหม่</p>
                <p className="text-sm text-slate-500">อนุญาตให้ผู้ใช้ใหม่ลงทะเบียนเองได้</p>
              </div>
              <Switch 
                checked={formData.allow_registration === "true"} 
                onCheckedChange={() => handleToggle("allow_registration")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_timeout">Session Timeout (นาที)</Label>
              <Input 
                id="session_timeout" 
                type="number" 
                value={formData.session_timeout || "60"}
                onChange={(e) => handleChange("session_timeout", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500"/>
              <CardTitle>การแจ้งเตือน MOPH Alert</CardTitle>
            </div>
            <CardDescription>จัดการเปิด-ปิดระบบส่งแจ้งเตือนผ่าน LINE หมอพร้อม</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "moph_alert_checkin_enabled", label: "แจ้งเตือนเมื่อลงเวลาเข้างาน", desc: "ส่งข้อความยืนยันเวลา Check-in" },
              { key: "moph_alert_checkout_enabled", label: "แจ้งเตือนเมื่อลงเวลาออกงาน", desc: "ส่งข้อความยืนยันเวลา Check-out" },
              { key: "moph_alert_reminder_enabled", label: "แจ้งเตือนให้ลงเวลาออกงาน", desc: "ส่งข้อความเตือนรายวันเวลา 17:00 น. สำหรับผู้ที่ยังไม่ได้ Check-out" },
            ].map((module) => (
              <div key={module.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="font-medium text-slate-700 text-sm">{module.label}</p>
                  <p className="text-xs text-slate-500">{module.desc}</p>
                </div>
                <Switch 
                  checked={formData[module.key] === "true"} 
                  onCheckedChange={() => handleToggle(module.key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>


    </div>
  );
}
