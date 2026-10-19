import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole, HR_ROLES } from "@/lib/roles";

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // เมนูนี้สำหรับผู้ดูแลระบบสูงสุด/ผู้ดูแล HR เท่านั้น
  if (!hasAnyRole(session?.user?.roles, HR_ROLES)) {
    redirect("/");
  }

  return children;
}
