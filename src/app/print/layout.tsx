import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ATTENDANCE_REPORT_ROLES, hasAnyRole } from "@/lib/roles";

/** หน้าสำหรับพิมพ์ (ไม่มี sidebar/header) ตรวจสิทธิ์ฝั่ง server: ผู้ดูแลระบบสูงสุด / ผู้ดูแล HR / หัวหน้างาน */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.status === "pending") redirect("/pending");
  if (!hasAnyRole(session.user.roles, ATTENDANCE_REPORT_ROLES)) redirect("/");

  return <div className="min-h-screen bg-slate-100 print:bg-white">{children}</div>;
}
