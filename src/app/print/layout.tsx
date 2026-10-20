import { redirect } from "next/navigation";
import { Sarabun } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ATTENDANCE_REPORT_ROLES, hasAnyRole } from "@/lib/roles";

/** ฟอนต์สำหรับเอกสารพิมพ์ (ตระกูลเดียวกับ TH Sarabun ที่ใช้ในหนังสือราชการ) */
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["latin", "thai"],
  weight: ["400", "600", "700"],
  display: "block",
});

/** หน้าสำหรับพิมพ์ (ไม่มี sidebar/header) ตรวจสิทธิ์ฝั่ง server: ผู้ดูแลระบบสูงสุด / ผู้ดูแล HR / หัวหน้างาน */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.status === "pending") redirect("/pending");
  if (!hasAnyRole(session.user.roles, ATTENDANCE_REPORT_ROLES)) redirect("/");

  return (
    <div className={`${sarabun.variable} min-h-screen bg-slate-100 print:bg-white`} style={{ fontFamily: "var(--font-sarabun), sans-serif" }}>
      {children}
    </div>
  );
}
