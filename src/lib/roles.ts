export type AppRole =
  | "superadmin"
  | "hradmin"
  | "itadmin"
  | "leader"
  | "staff";

type AdminNavItem = {
  href: string;
  icon: "users" | "building2" | "fileText" | "settings" | "clock";
  name: string;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: "ผู้ดูแลระบบสูงสุด",
  hradmin: "ผู้ดูแล HR",
  itadmin: "ผู้ดูแล IT",
  leader: "หัวหน้างาน",
  staff: "เจ้าหน้าที่",
};

export const ADMIN_NAV_BY_ROLE: Partial<Record<AppRole, AdminNavItem[]>> = {
  superadmin: [
    { name: "จัดการผู้ใช้งาน", href: "/admin/users", icon: "users" },
    { name: "จัดการกลุ่มงาน", href: "/admin/departments", icon: "building2" },
    { name: "รายการลงเวลา", href: "/admin/attendance", icon: "clock" },
    { name: "รายการลาทั้งหมด", href: "/admin/leaves", icon: "fileText" },
    { name: "ตั้งค่าระบบ", href: "/admin/settings", icon: "settings" },
  ],
  hradmin: [
    { name: "รายการลงเวลา", href: "/admin/attendance", icon: "clock" },
    { name: "รายการลาทั้งหมด", href: "/admin/leaves", icon: "fileText" },
  ],
  itadmin: [
    { name: "จัดการผู้ใช้งาน", href: "/admin/users", icon: "users" },
    { name: "จัดการกลุ่มงาน", href: "/admin/departments", icon: "building2" },
    { name: "ตั้งค่าระบบ", href: "/admin/settings", icon: "settings" },
  ],
};

export function getRoleLabel(role?: string) {
  if (!role) {
    return "ผู้ใช้งาน";
  }

  return ROLE_LABELS[role as AppRole] ?? role;
}

export function getAdminNavigation(role?: string) {
  if (!role) {
    return [];
  }

  return ADMIN_NAV_BY_ROLE[role as AppRole] ?? [];
}
