"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon, Clock, Users, FileText, Monitor, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Swal from "sweetalert2";
import { trpc } from "@/trpc/client";
import Link from "next/link";

import { Suspense } from "react";

function BookMeetingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRoomId = searchParams?.get("roomId");
  
  const [date, setDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomId, setRoomId] = useState(defaultRoomId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");
  const [equipment, setEquipment] = useState("");
  
  const { data: rooms } = trpc.meeting.getRooms.useQuery();
  const createBooking = trpc.meeting.createBooking.useMutation({
    onSuccess: () => {
      Swal.fire({
        title: "จองห้องประชุมสำเร็จ",
        text: "คำขอของคุณถูกส่งไปยังผู้ดูแลระบบเพื่อพิจารณาแล้ว",
        icon: "success",
        confirmButtonColor: "#2563eb",
      }).then(() => {
        router.push("/meeting/my-bookings");
      });
    },
    onError: (error) => {
      Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomId || !title || !date || !startTime || !endTime || !attendees) {
      Swal.fire("ข้อมูลไม่ครบถ้วน", "กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ", "warning");
      return;
    }

    createBooking.mutate({
      roomId: parseInt(roomId),
      title,
      description,
      date,
      startTime,
      endTime,
      attendees: parseInt(attendees),
      equipmentNeeds: equipment,
    });
  };

 // Generate time options (08:00 to 18:00 every 30 mins)
  const timeOptions = [];
  for (let h = 8; h <= 18; h++) {
    for (let m of ["00", "30"]) {
      if (h === 18 && m === "30") continue;
      const hourStr = h.toString().padStart(2, "0");
      timeOptions.push(`${hourStr}:${m}`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.push("/meeting")}>
          <ChevronLeft className="w-5 h-5"/>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">แบบฟอร์มจองห้องประชุม</h1>
          <p className="text-slate-500 mt-1">กรอกรายละเอียดเพื่อขอใช้งานห้องประชุม</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600"/>
              รายละเอียดการประชุม
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* Row 1: Room & Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">ห้องประชุม <span className="text-red-500">*</span></label>
                <Select value={roomId} onValueChange={(val) => val && setRoomId(val)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="เลือกห้องประชุม"/>
                  </SelectTrigger>
                  <SelectContent>
                    {rooms?.map(room => (
                      <SelectItem key={room.id} value={room.id.toString()}>{room.name}</SelectItem>
                    ))}
                    {!rooms && (
                      <>
                        <SelectItem value="1">ห้องประชุมพุทธชินราช (ชั้น 1)</SelectItem>
                        <SelectItem value="2">ห้องประชุม 2 (ชั้น 3)</SelectItem>
                        <SelectItem value="3">ห้องประชุม 3 (ชั้น 4)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">หัวข้อการประชุม <span className="text-red-500">*</span></label>
                <Input 
                  placeholder="ระบุชื่อเรื่อง หรือหัวข้อการประชุม" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white"
               />
              </div>
            </div>

            {/* Row 2: Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 flex flex-col">
                <label className="text-sm font-medium text-slate-700">วันที่ <span className="text-red-500">*</span></label>
                <Popover>
                  <PopoverTrigger 
                    render={
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white",
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
                      onSelect={setDate}
                      initialFocus
                   />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">ตั้งแต่เวลา <span className="text-red-500">*</span></label>
                <Select value={startTime} onValueChange={(val) => val && setStartTime(val)}>
                  <SelectTrigger className="bg-white">
                    <Clock className="w-4 h-4 mr-2 text-slate-400"/>
                    <SelectValue placeholder="เวลาเริ่ม"/>
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(t => (
                      <SelectItem key={`start-${t}`} value={t}>{t} น.</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">ถึงเวลา <span className="text-red-500">*</span></label>
                <Select value={endTime} onValueChange={(val) => val && setEndTime(val)}>
                  <SelectTrigger className="bg-white">
                    <Clock className="w-4 h-4 mr-2 text-slate-400"/>
                    <SelectValue placeholder="เวลาสิ้นสุด"/>
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(t => (
                      <SelectItem key={`end-${t}`} value={t}>{t} น.</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Attendees & Equipment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">จำนวนผู้เข้าร่วมโดยประมาณ <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                  <Input 
                    type="number" 
                    min="1" 
                    placeholder="ระบุจำนวนคน" 
                    className="pl-9 bg-white"
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                 />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">อุปกรณ์ที่ต้องการเพิ่มเติม (ถ้ามี)</label>
                <div className="relative">
                  <Monitor className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                  <Input 
                    placeholder="เช่น ปลั๊กพ่วง, ไมค์ลอยเพิ่ม 2 ตัว" 
                    className="pl-9 bg-white"
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                 />
                </div>
              </div>
            </div>

            {/* Row 4: Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
              <Textarea 
                placeholder="ระบุรายละเอียดการใช้งานเพิ่มเติม..." 
                className="min-h-[100px] bg-white resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
             />
            </div>

          </CardContent>
          <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => router.push("/meeting")}>
              ยกเลิก
            </Button>
            <Button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "กำลังบันทึก..." : "ยืนยันการจอง"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export default function BookMeetingPage() {
  return (
    <Suspense fallback={<div>กำลังโหลด...</div>}>
      <BookMeetingForm/>
    </Suspense>
  );
}
