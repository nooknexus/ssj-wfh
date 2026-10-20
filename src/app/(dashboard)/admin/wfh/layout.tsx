import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole, ADMIN_ROLES } from "@/lib/roles";

export default async function AdminWfhLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // เฉพาะบทบาทผู้ดูแล (หัวหน้างานที่ไม่ใช่ผู้ดูแลเข้าไม่ได้)
  if (!hasAnyRole(session?.user?.roles, ADMIN_ROLES)) {
    redirect("/");
  }

  return children;
}
