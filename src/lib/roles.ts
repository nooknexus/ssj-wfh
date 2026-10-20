export type AppRole =
  | "superadmin"
  | "hradmin"
  | "itadmin"
  | "leader"
  | "staff";

/** บทบาทเพิ่มเติมที่กำหนดได้ (staff เป็นบทบาทโดยปริยายของทุกคน) */
export type AssignableRole = Exclude<AppRole, "staff">;

type AdminNavItem = {
  href: string;
  icon: "users" | "building2" | "fileText" | "settings" | "clock";
  name: string;
};

/** เรียงจากสิทธิ์สูงสุดไปต่ำสุด */
export const ROLE_PRIORITY: AppRole[] = ["superadmin", "itadmin", "hradmin", "leader", "staff"];

export const ASSIGNABLE_ROLES: AssignableRole[] = ["superadmin", "itadmin", "hradmin", "leader"];

export const ADMIN_ROLES: AppRole[] = ["superadmin", "itadmin", "hradmin"];
export const USER_MANAGER_ROLES: AppRole[] = ["superadmin", "itadmin"];
export const HR_ROLES: AppRole[] = ["superadmin", "hradmin"];
export const WFH_APPROVER_ROLES: AppRole[] = ["superadmin", "hradmin", "leader"];

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

const isAppRole = (value: unknown): value is AppRole =>
  typeof value === "string" && (ROLE_PRIORITY as string[]).includes(value);

/** แปลงค่าบทบาทจากแหล่งใดก็ได้ให้เป็น array ที่มี staff เสมอ ไม่ซ้ำ และเรียงตามลำดับสิทธิ์ */
export const normalizeRoles = (input?: unknown): AppRole[] => {
  const values = Array.isArray(input) ? input : [input];
  const roles = new Set<AppRole>(["staff"]);
  for (const value of values) {
    if (isAppRole(value)) roles.add(value);
  }
  return ROLE_PRIORITY.filter((role) => roles.has(role));
};

export const hasRole = (roles: readonly string[] | undefined, role: AppRole): boolean =>
  normalizeRoles(roles).includes(role);

export const hasAnyRole = (roles: readonly string[] | undefined, allowed: readonly AppRole[]): boolean =>
  allowed.some((role) => hasRole(roles, role));

export const getPrimaryRole = (roles?: readonly string[]): AppRole => normalizeRoles(roles)[0];

export const getRoleLabel = (role?: string): string => {
  if (!role) return "ผู้ใช้งาน";
  return isAppRole(role) ? ROLE_LABELS[role] : role;
};

export const getRoleLabels = (roles?: readonly string[]): string[] =>
  normalizeRoles(roles).map((role) => ROLE_LABELS[role]);

/** รวมเมนู admin ของทุกบทบาท ตัดรายการซ้ำตาม href โดยคงลำดับของบทบาทที่สูงกว่า */
export const getAdminNavigation = (roles?: readonly string[]): AdminNavItem[] => {
  const seen = new Set<string>();
  return normalizeRoles(roles)
    .flatMap((role) => ADMIN_NAV_BY_ROLE[role] ?? [])
    .filter((item) => !seen.has(item.href) && Boolean(seen.add(item.href)));
};

type RoleChangeInput = {
  actorRoles: readonly string[];
  targetCurrentRoles: readonly string[];
  nextRoles: readonly AssignableRole[];
  superadminCount: number;
};

/** ตรวจกฎการเปลี่ยนบทบาท คืนข้อความผิดพลาด หรือ null ถ้าเปลี่ยนได้ */
export const validateRoleChange = (input: RoleChangeInput): string | null => {
  if (!hasAnyRole(input.actorRoles, USER_MANAGER_ROLES)) {
    return "ไม่มีสิทธิ์กำหนดบทบาทผู้ใช้งาน";
  }
  const hadSuperadmin = hasRole(input.targetCurrentRoles, "superadmin");
  const willHaveSuperadmin = input.nextRoles.includes("superadmin");
  const touchesSuperadmin = hadSuperadmin !== willHaveSuperadmin;
  if (touchesSuperadmin && !hasRole(input.actorRoles, "superadmin")) {
    return "เฉพาะผู้ดูแลระบบสูงสุดเท่านั้นที่กำหนดบทบาทผู้ดูแลระบบสูงสุดได้";
  }
  if (hadSuperadmin && !willHaveSuperadmin && input.superadminCount <= 1) {
    return "ไม่สามารถถอดบทบาทผู้ดูแลระบบสูงสุดคนสุดท้ายได้";
  }
  return null;
};

/** ป้ายบทบาทแบบย่อ: บทบาทสูงสุด และ "+N" เมื่อมีบทบาทเพิ่มเติมอื่น (ไม่นับ staff) */
export const getRoleSummary = (roles?: readonly string[]): { label: string; full: string } => {
  const normalized = normalizeRoles(roles);
  const extraCount = normalized.filter((role) => role !== "staff").length - 1;
  const label = ROLE_LABELS[normalized[0]];
  return {
    label: extraCount > 0 ? `${label} +${extraCount}` : label,
    full: getRoleLabels(normalized).join(", "),
  };
};

type DepartmentApprovalInput = {
  approverRoles: readonly string[];
  approverDepartmentId: number | null | undefined;
  requesterDepartmentId: number | null | undefined;
};

/**
 * ตรวจว่าผู้อนุมัติจัดการคำขอนี้ได้หรือไม่: hradmin/superadmin ได้ทุกกลุ่มงาน
 * ส่วน leader ได้เฉพาะคำขอของผู้ใช้ในกลุ่มงาน (department_id) เดียวกัน
 */
export const canApproveDepartmentRequest = (input: DepartmentApprovalInput): boolean => {
  if (hasAnyRole(input.approverRoles, HR_ROLES)) return true;
  if (!hasRole(input.approverRoles, "leader")) return false;
  return input.approverDepartmentId != null && input.approverDepartmentId === input.requesterDepartmentId;
};

/**
 * ตรวจว่าอนุมัติคำขอได้หรือไม่ (WFH, ลา/ไปราชการจากแผนงาน): เฉพาะ leader ของกลุ่มงาน (department_id) เดียวกับผู้ขอเท่านั้น
 * hradmin/superadmin ดูคำขอได้ทุกกลุ่มงานแต่ไม่มีสิทธิ์อนุมัติ เว้นแต่จะเป็น leader ของกลุ่มงานนั้นด้วย
 */
export const canApproveDepartmentLeaderRequest = (input: DepartmentApprovalInput): boolean =>
  hasRole(input.approverRoles, "leader") &&
  input.approverDepartmentId != null &&
  input.approverDepartmentId === input.requesterDepartmentId;

/** ชื่อเดิม คงไว้เพื่อความเข้ากันได้ */
export const canApproveWfhRequest = canApproveDepartmentLeaderRequest;
