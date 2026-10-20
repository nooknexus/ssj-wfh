import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole, CONFERENCE_ADMIN_ROLES } from "@/lib/roles";

export default async function AdminMeetingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // จัดการ Web Conference: เฉพาะผู้ดูแล IT / ผู้ดูแลระบบสูงสุด
  if (!hasAnyRole(session?.user?.roles, CONFERENCE_ADMIN_ROLES)) {
    redirect("/");
  }

  return children;
}
