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
/** จัดการผู้ใช้งานและกลุ่มงานได้ (hradmin กำหนดบทบาทได้จำกัด ดู getGrantableRoles) */
export const USER_MANAGER_ROLES: AppRole[] = ["superadmin", "itadmin", "hradmin"];
/** ตั้งค่าระบบได้ */
export const SYSTEM_ADMIN_ROLES: AppRole[] = ["superadmin", "itadmin"];
/** บทบาทผู้ดูแลระบบที่ hradmin ให้ ถอด หรือแก้สถานะบัญชีไม่ได้ */
export const PRIVILEGED_ROLES: AssignableRole[] = ["superadmin", "itadmin"];
export const HR_ROLES: AppRole[] = ["superadmin", "hradmin"];
export const WFH_APPROVER_ROLES: AppRole[] = ["superadmin", "hradmin", "leader"];
/** ดูรายงานการลงเวลาได้ (leader เห็นเฉพาะกลุ่มงานตัวเอง) */
export const ATTENDANCE_REPORT_ROLES: AppRole[] = ["superadmin", "hradmin", "leader"];
/** เข้าเขต /admin ได้ (สิทธิ์รายหน้าตรวจซ้ำใน layout ของแต่ละหน้า) */
export const ADMIN_AREA_ROLES: AppRole[] = ["superadmin", "itadmin", "hradmin", "leader"];
/** จัดการลิงก์ Web Conference และอนุมัติการจอง */
export const CONFERENCE_ADMIN_ROLES: AppRole[] = ["superadmin", "itadmin"];

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
    { name: "จัดการผู้ใช้งาน", href: "/admin/users", icon: "users" },
    { name: "จัดการกลุ่มงาน", href: "/admin/departments", icon: "building2" },
    { name: "รายการลงเวลา", href: "/admin/attendance", icon: "clock" },
    { name: "รายการลาทั้งหมด", href: "/admin/leaves", icon: "fileText" },
  ],
  leader: [
    { name: "รายการลงเวลา", href: "/admin/attendance", icon: "clock" },
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

/**
 * บทบาทที่ผู้ใช้คนนี้ให้หรือถอดได้
 * superadmin: ทุกบทบาท  itadmin: ทุกบทบาทยกเว้น superadmin  hradmin: เฉพาะ hradmin และ leader
 */
export const getGrantableRoles = (actorRoles?: readonly string[]): AssignableRole[] => {
  if (hasRole(actorRoles, "superadmin")) return [...ASSIGNABLE_ROLES];
  if (hasRole(actorRoles, "itadmin")) return ASSIGNABLE_ROLES.filter((role) => role !== "superadmin");
  if (hasRole(actorRoles, "hradmin")) return ASSIGNABLE_ROLES.filter((role) => !PRIVILEGED_ROLES.includes(role));
  return [];
};

/** แก้สถานะบัญชีได้หรือไม่: ทุกบทบาทผู้ดูแลระบบที่เป้าหมายมี ต้องเป็นบทบาทที่ผู้แก้ให้ได้ */
export const canManageAccount = (actorRoles: readonly string[], targetRoles: readonly string[]): boolean => {
  if (!hasAnyRole(actorRoles, USER_MANAGER_ROLES)) return false;
  const grantable = getGrantableRoles(actorRoles);
  return PRIVILEGED_ROLES.every((role) => !hasRole(targetRoles, role) || grantable.includes(role));
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
  const touchesItadmin = hasRole(input.targetCurrentRoles, "itadmin") !== input.nextRoles.includes("itadmin");
  if (touchesItadmin && !getGrantableRoles(input.actorRoles).includes("itadmin")) {
    return "เฉพาะผู้ดูแลระบบสูงสุดหรือผู้ดูแล IT เท่านั้นที่กำหนดบทบาทผู้ดูแล IT ได้";
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

type ReportScopeInput = {
  roles: readonly string[];
  ownDepartmentId: number | null | undefined;
  requestedDepartmentId?: number;
};

/**
 * ขอบเขตกลุ่มงานของรายงานการลงเวลา
 * hradmin/superadmin เลือกได้ทุกกลุ่มงาน, หัวหน้างานถูกบังคับให้เห็นเฉพาะกลุ่มงานตัวเอง
 */
export const resolveAttendanceReportScope = (
  input: ReportScopeInput,
): { departmentId: number | undefined } | { error: string } => {
  if (hasAnyRole(input.roles, HR_ROLES)) return { departmentId: input.requestedDepartmentId };
  if (!hasRole(input.roles, "leader")) return { error: "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" };
  if (input.ownDepartmentId == null) return { error: "ยังไม่ได้กำหนดกลุ่มงานของท่าน กรุณาติดต่อผู้ดูแลระบบ" };
  return { departmentId: input.ownDepartmentId };
};
