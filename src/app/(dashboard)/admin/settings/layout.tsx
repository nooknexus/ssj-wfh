import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole, USER_MANAGER_ROLES } from "@/lib/roles";

export default async function UserManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // เมนูนี้สำหรับผู้ดูแลระบบสูงสุด/ผู้ดูแล IT เท่านั้น
  if (!hasAnyRole(session?.user?.roles, USER_MANAGER_ROLES)) {
    redirect("/");
  }

  return children;
}
