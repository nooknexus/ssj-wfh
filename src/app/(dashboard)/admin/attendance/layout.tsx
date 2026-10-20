import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole, ATTENDANCE_REPORT_ROLES } from "@/lib/roles";

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // เมนูนี้สำหรับผู้ดูแลระบบสูงสุด / ผู้ดูแล HR / หัวหน้างาน (เห็นเฉพาะกลุ่มงานตัวเอง)
  if (!hasAnyRole(session?.user?.roles, ATTENDANCE_REPORT_ROLES)) {
    redirect("/");
  }

  return children;
}
