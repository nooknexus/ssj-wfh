import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ADMIN_AREA_ROLES, hasAnyRole } from "@/lib/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // ตรวจสิทธิ์ฝั่ง server: ต้องมีบทบาทผู้ดูแลหรือหัวหน้างาน (สิทธิ์รายหน้าตรวจซ้ำใน layout ของแต่ละหน้าและ tRPC roleProcedure)
  if (!hasAnyRole(session?.user?.roles, ADMIN_AREA_ROLES)) {
    redirect("/");
  }

  return children;
}
