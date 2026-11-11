"use client";

import { Satellite } from "lucide-react";
import { getDevicePlatform, type DevicePlatform } from "@/lib/geolocation";

const STEPS: Record<DevicePlatform, string[]> = {
  ios: [
    "เปิด การตั้งค่า > ความเป็นส่วนตัวและความปลอดภัย > บริการหาตำแหน่ง (Location Services) ให้เปิดอยู่",
    "ในรายการเดียวกัน เลือกแอปที่ใช้เปิดระบบนี้ (Safari, Chrome หรือ LINE) แล้วเลือก \"ขณะใช้งานแอป\" และเปิด \"ตำแหน่งที่แม่นยำ\" (Precise Location)",
  ],
  android: [
    "ดึงแถบด้านบนของจอลงมา แล้วเปิด \"ตำแหน่ง\" (Location)",
    "การตั้งค่า > ตำแหน่ง > บริการตำแหน่ง > เปิด \"ความแม่นยำของตำแหน่งใน Google\" (Google Location Accuracy)",
    "อนุญาตให้ browser (เช่น Chrome) เข้าถึงตำแหน่งแบบ \"แม่นยำ\" (Precise)",
  ],
  other: [
    "คอมพิวเตอร์ส่วนใหญ่ไม่มี GPS จึงใช้ตำแหน่งจากอินเทอร์เน็ตซึ่งคลาดเคลื่อนมาก แนะนำให้ลงเวลาจากสมาร์ทโฟนที่เปิด GPS",
  ],
};

/** แนะนำให้เปิด GPS เมื่อพิกัดหยาบจนน่าจะมาจาก Wi-Fi/เครือข่ายมือถือ */
export function GpsHint({ accuracy }: { accuracy: number }) {
  const platform = getDevicePlatform(navigator.userAgent, navigator.maxTouchPoints);

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
      <Satellite className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
      <div className="text-xs leading-relaxed space-y-1">
        <p className="font-bold">
          พิกัดนี้น่าจะมาจาก Wi-Fi หรือเครือข่ายมือถือ ไม่ใช่ GPS (คลาดเคลื่อนประมาณ ±{Math.round(accuracy)} ม.)
        </p>
        <p>กรุณาเปิด GPS ของเครื่องเพื่อให้ได้พิกัดที่แม่นยำ:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          {STEPS[platform].map((step) => (
            <li key={step}>{step}</li>
          ))}
          <li>ปิด Wi-Fi ชั่วคราว ขยับไปใกล้หน้าต่างหรือที่โล่ง แล้วกด &quot;รีโหลด&quot;</li>
        </ol>
      </div>
    </div>
  );
}
