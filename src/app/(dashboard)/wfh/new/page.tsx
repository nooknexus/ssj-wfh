"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, CalendarIcon } from "lucide-react";
import Link from "next/link";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { differenceInDays, startOfDay } from "date-fns";
import { trpc } from "@/trpc/client";
import { Label } from "@/components/ui/label";

export default function NewWFHPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("1");

  // Calculate days automatically when dates change
  useEffect(() => {
    if (date && endDate) {
      const start = startOfDay(date);
      const end = startOfDay(endDate);
      const diff = differenceInDays(end, start) + 1;
      setDays(diff > 0 ? diff.toString() : "1");
    }
  }, [date, endDate]);

  const utils = trpc.useUtils();
  const createMutation = trpc.wfh.create.useMutation({
    onSuccess: () => {
      Swal.fire(
        "ส่งคำขอสำเร็จ!",
        "คำขอของคุณถูกส่งไปยังผู้บังคับบัญชาเรียบร้อยแล้ว",
        "success"
      ).then(() => {
        utils.wfh.getUserRequests.invalidate();
        utils.attendance.getHistory.invalidate();
        router.push("/attendance");
      });
    },
    onError: (error) => {
      Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
    },
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !endDate || !reason) {
      Swal.fire({
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
        icon: "warning",
        confirmButtonText: "ตกลง",
      });
      return;
    }

    Swal.fire({
      title: "ยืนยันการส่งคำขอ?",
      text: "คุณต้องการส่งคำขอปฏิบัติงานที่บ้านใช่หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
    }).then((result) => {
      if (result.isConfirmed) {
        createMutation.mutate({
          startDate: date,
          endDate: endDate,
          reason: reason,
        });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/attendance">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4"/>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">สร้างคำขอ WFH ใหม่</h1>
          <p className="text-slate-500 mt-1">กรอกแบบฟอร์มเพื่อขออนุมัติปฏิบัติงานที่บ้าน</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">รายละเอียดการปฏิบัติงานที่บ้าน</CardTitle>
          <CardDescription>โปรดระบุวันที่และเหตุผลให้ชัดเจน</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 flex flex-col">
                <Label>วันที่เริ่มต้น <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4"/>
                    {date ? format(date, "PPP", { locale: th }) : <span>เลือกวันที่...</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => {
                        setDate(newDate);
                        if (newDate && endDate && newDate > endDate) {
                          setEndDate(undefined);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2 flex flex-col">
                <Label>วันที่สิ้นสุด <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4"/>
                    {endDate ? format(endDate, "PPP", { locale: th }) : <span>เลือกวันที่...</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      disabled={(d) => (date ? d < startOfDay(date) : false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>จำนวนวัน <span className="text-red-500">*</span></Label>
              <Input 
                type="number" 
                value={days}
                readOnly
                placeholder="0" 
                className="max-w-[200px] bg-slate-50 font-semibold text-blue-600 border-blue-100"
              />
              <p className="text-[10px] text-slate-400">ระบบคำนวณจากวันที่เริ่มต้นถึงสิ้นสุดโดยอัตโนมัติ</p>
            </div>

            <div className="space-y-2">
              <Label>เหตุผล/แผนการปฏิบัติงาน <span className="text-red-500">*</span></Label>
              <Textarea 
                placeholder="ระบุรายละเอียดงานที่ต้องการปฏิบัติ..." 
                className="min-h-[120px] resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
              <Link href="/attendance">
                <Button variant="ghost" type="button">ยกเลิก</Button>
              </Link>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2"/>
                ส่งคำขออนุมัติ
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
