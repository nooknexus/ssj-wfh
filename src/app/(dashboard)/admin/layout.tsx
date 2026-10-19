import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ADMIN_ROLES, hasAnyRole } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // ตรวจสิทธิ์ฝั่ง server: ต้องมีบทบาทผู้ดูแลอย่างน้อยหนึ่งบทบาท (สิทธิ์รายเมนูตรวจซ้ำที่ tRPC roleProcedure)
  if (!hasAnyRole(session?.user?.roles, ADMIN_ROLES)) {
    redirect("/");
  }

  return children;
}
