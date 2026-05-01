"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Monitor, Video, CalendarPlus, MapPin, Wifi, Projector } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { ModuleGuard } from "@/components/layout/module-guard";

// Mock data to show if DB is empty for demonstration purposes
const MOCK_ROOMS = [
  {
    id: 1,
    name: "ห้องประชุมพุทธชินราช (ชั้น 1)",
    description: "ห้องประชุมขนาดใหญ่ เหมาะสำหรับการประชุมระดับจังหวัดและการสัมมนา",
    capacity: 100,
    location: "อาคาร 1 ชั้น 1",
    facilities: ["Projector", "Video Conference", "Microphone", "Wifi"],
    image_url: "https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&q=80&w=600&h=400",
    status: "active",
  },
  {
    id: 2,
    name: "ห้องประชุม 2 (ชั้น 3)",
    description: "ห้องประชุมขนาดกลาง เหมาะสำหรับการประชุมกลุ่มงานย่อย",
    capacity: 30,
    location: "อาคาร 1 ชั้น 3",
    facilities: ["TV", "Microphone", "Wifi"],
    image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600&h=400",
    status: "active",
  },
  {
    id: 3,
    name: "ห้องประชุม 3 (ชั้น 4)",
    description: "ห้องประชุมขนาดเล็ก เหมาะสำหรับการประชุมออนไลน์และประชุมทีม",
    capacity: 15,
    location: "อาคาร 1 ชั้น 4",
    facilities: ["TV", "Wifi", "Whiteboard"],
    image_url: "https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=600&h=400",
    status: "active",
  }
];

const getFacilityIcon = (facility: string) => {
  const f = facility.toLowerCase();
  if (f.includes('projector')) return <Projector className="w-3.5 h-3.5"/>;
  if (f.includes('video')) return <Video className="w-3.5 h-3.5"/>;
  if (f.includes('wifi')) return <Wifi className="w-3.5 h-3.5"/>;
  if (f.includes('tv') || f.includes('monitor')) return <Monitor className="w-3.5 h-3.5"/>;
  return null;
};

export default function MeetingRoomsPage() {
 // Use trpc to fetch rooms if available
  const { data: dbRooms, isLoading } = trpc.meeting.getRooms.useQuery();
  
 // Use DB rooms if they exist, otherwise fallback to mock data
  const rooms = dbRooms && dbRooms.length > 0 ? dbRooms : MOCK_ROOMS;

  return (
    <ModuleGuard moduleKey="module_meeting">
      <div className="space-y-6">
        {/* ... existing content ... */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">จองห้องประชุม</h1>
            <p className="text-slate-500 mt-1">เลือกห้องประชุมที่ต้องการใช้งาน และดูตารางการจอง</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = "/meeting/my-bookings"}>
              การจองของฉัน
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-slate-100 rounded-xl border border-slate-200"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id} className="overflow-hidden border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
                <div className="relative h-48 w-full bg-slate-100">
                  {room.image_url ? (
                    <Image 
                      src={room.image_url} 
                      alt={room.name}
                      fill
                      className="object-cover"
                   />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <Monitor className="w-12 h-12 opacity-20"/>
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-emerald-500/90 hover:bg-emerald-500 text-white border-0 shadow-sm backdrop-blur-sm">
                      พร้อมใช้งาน
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg line-clamp-1">{room.name}</CardTitle>
                  <div className="flex items-center text-xs text-slate-500 mt-1.5">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400"/>
                    {room.location}
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4">
                  <p className="text-sm text-slate-600 line-clamp-2 min-h-[40px] mb-4">
                    {room.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100">
                      <Users className="w-3.5 h-3.5 mr-1"/>
                      รับได้ {room.capacity} คน
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-500">สิ่งอำนวยความสะดวก:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Handle both JSON array string from DB or real array from mock */}
                      {Array.isArray(room.facilities) ? (room.facilities as any[]).map((facility: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs font-normal text-slate-600 border-slate-200">
                          {getFacilityIcon(facility)}
                          <span className="ml-1">{facility}</span>
                        </Badge>
                      )) : typeof room.facilities === 'string' && room.facilities.length > 0 ? 
                        (() => {
                          try {
                            const parsed = JSON.parse(room.facilities);
                            return Array.isArray(parsed) ? parsed.map((facility: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs font-normal text-slate-600 border-slate-200">
                                {getFacilityIcon(facility)}
                                <span className="ml-1">{facility}</span>
                              </Badge>
                            )) : null;
                          } catch (e) {
                            return null;
                          }
                        })()
                      : null}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0 pb-4 px-6">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={() => window.location.href = `/meeting/book?roomId=${room.id}`}>
                    <CalendarPlus className="w-4 h-4 mr-2"/>
                    จองห้องนี้
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ModuleGuard>
  );
}
