import { describe, expect, it } from "vitest";
import {
  canApproveDepartmentRequest,
  canManageAccount,
  canApproveWfhRequest,
  getAdminNavigation,
  getGrantableRoles,
  getPrimaryRole,
  getRoleLabel,
  getRoleLabels,
  getRoleSummary,
  hasAnyRole,
  hasRole,
  normalizeRoles,
  resolveAttendanceReportScope,
  validateRoleChange,
} from "./roles";

describe("normalizeRoles", () => {
  it("should always include staff", () => {
    expect(normalizeRoles(undefined)).toEqual(["staff"]);
    expect(normalizeRoles([])).toEqual(["staff"]);
  });

  it("should accept a single legacy role string", () => {
    expect(normalizeRoles("itadmin")).toEqual(["itadmin", "staff"]);
  });

  it("should dedupe, drop unknown values and sort by priority", () => {
    expect(normalizeRoles(["leader", "hradmin", "leader", "admin", 1])).toEqual([
      "hradmin",
      "leader",
      "staff",
    ]);
  });
});

describe("hasRole / hasAnyRole", () => {
  it("should treat every user as staff", () => {
    expect(hasRole(undefined, "staff")).toBe(true);
  });

  it("should match any of the allowed roles", () => {
    expect(hasAnyRole(["hradmin", "leader"], ["leader"])).toBe(true);
    expect(hasAnyRole(["hradmin"], ["itadmin", "superadmin"])).toBe(false);
  });
});

describe("getPrimaryRole / labels", () => {
  it("should return the highest priority role", () => {
    expect(getPrimaryRole(["leader", "itadmin"])).toBe("itadmin");
    expect(getPrimaryRole([])).toBe("staff");
  });

  it("should map labels for all roles", () => {
    expect(getRoleLabels(["leader"])).toEqual(["หัวหน้างาน", "เจ้าหน้าที่"]);
    expect(getRoleLabel(undefined)).toBe("ผู้ใช้งาน");
    expect(getRoleLabel("unknown")).toBe("unknown");
  });
});

describe("getAdminNavigation", () => {
  it("should be empty for staff", () => {
    expect(getAdminNavigation(["staff"])).toEqual([]);
  });

  it("should merge menus of multiple roles without duplicates", () => {
    const hrefs = getAdminNavigation(["hradmin", "itadmin"]).map((item) => item.href);
    expect(hrefs).toEqual([
      "/admin/users",
      "/admin/departments",
      "/admin/meeting",
      "/admin/settings",
      "/admin/attendance",
      "/admin/leaves",
    ]);
  });
});

describe("validateRoleChange", () => {
  const base = { targetCurrentRoles: ["staff"], nextRoles: [], superadminCount: 2 } as const;

  it("should reject actors without user-manager role", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["leader"], nextRoles: ["leader"] })).not.toBeNull();
  });

  it("should allow itadmin to assign non-superadmin roles", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["itadmin"], nextRoles: ["leader", "hradmin"] })).toBeNull();
  });

  it("should forbid itadmin from granting or revoking superadmin", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["itadmin"], nextRoles: ["superadmin"] })).not.toBeNull();
    expect(
      validateRoleChange({ ...base, actorRoles: ["itadmin"], targetCurrentRoles: ["superadmin"], nextRoles: [] }),
    ).not.toBeNull();
  });

  it("should let itadmin change other roles of a superadmin user", () => {
    expect(
      validateRoleChange({
        ...base,
        actorRoles: ["itadmin"],
        targetCurrentRoles: ["superadmin"],
        nextRoles: ["superadmin", "leader"],
      }),
    ).toBeNull();
  });

  it("should forbid removing the last superadmin", () => {
    expect(
      validateRoleChange({
        actorRoles: ["superadmin"],
        targetCurrentRoles: ["superadmin"],
        nextRoles: ["itadmin"],
        superadminCount: 1,
      }),
    ).not.toBeNull();
  });
});

describe("getRoleSummary", () => {
  it("should show only the label for a single role", () => {
    expect(getRoleSummary(["itadmin"]).label).toBe("ผู้ดูแล IT");
    expect(getRoleSummary([]).label).toBe("เจ้าหน้าที่");
  });

  it("should append extra non-staff role count and list all roles", () => {
    expect(getRoleSummary(["hradmin", "leader"])).toEqual({
      label: "ผู้ดูแล HR +1",
      full: "ผู้ดูแล HR, หัวหน้างาน, เจ้าหน้าที่",
    });
  });
});

describe("canApproveDepartmentRequest", () => {
  it("should allow hradmin and superadmin for any department", () => {
    expect(canApproveDepartmentRequest({ approverRoles: ["hradmin"], approverDepartmentId: 1, requesterDepartmentId: 2 })).toBe(true);
    expect(canApproveDepartmentRequest({ approverRoles: ["superadmin"], approverDepartmentId: null, requesterDepartmentId: null })).toBe(true);
  });

  it("should allow leader only within the same department", () => {
    expect(canApproveDepartmentRequest({ approverRoles: ["leader"], approverDepartmentId: 3, requesterDepartmentId: 3 })).toBe(true);
    expect(canApproveDepartmentRequest({ approverRoles: ["leader"], approverDepartmentId: 3, requesterDepartmentId: 4 })).toBe(false);
  });

  it("should deny leader without a department even if requester has none", () => {
    expect(canApproveDepartmentRequest({ approverRoles: ["leader"], approverDepartmentId: null, requesterDepartmentId: null })).toBe(false);
    expect(canApproveDepartmentRequest({ approverRoles: ["leader"], approverDepartmentId: undefined, requesterDepartmentId: undefined })).toBe(false);
  });

  it("should deny roles that are not approvers", () => {
    expect(canApproveDepartmentRequest({ approverRoles: ["staff"], approverDepartmentId: 1, requesterDepartmentId: 1 })).toBe(false);
    expect(canApproveDepartmentRequest({ approverRoles: ["itadmin"], approverDepartmentId: 1, requesterDepartmentId: 1 })).toBe(false);
  });
});

describe("canApproveWfhRequest", () => {
  it("should allow leader only within the same department", () => {
    expect(canApproveWfhRequest({ approverRoles: ["leader"], approverDepartmentId: 3, requesterDepartmentId: 3 })).toBe(true);
    expect(canApproveWfhRequest({ approverRoles: ["leader"], approverDepartmentId: 3, requesterDepartmentId: 4 })).toBe(false);
  });

  it("should deny leader when either side has no department", () => {
    expect(canApproveWfhRequest({ approverRoles: ["leader"], approverDepartmentId: null, requesterDepartmentId: null })).toBe(false);
    expect(canApproveWfhRequest({ approverRoles: ["leader"], approverDepartmentId: 3, requesterDepartmentId: null })).toBe(false);
  });

  it("should deny hradmin and superadmin who are not leaders", () => {
    expect(canApproveWfhRequest({ approverRoles: ["hradmin"], approverDepartmentId: 3, requesterDepartmentId: 3 })).toBe(false);
    expect(canApproveWfhRequest({ approverRoles: ["superadmin"], approverDepartmentId: 3, requesterDepartmentId: 3 })).toBe(false);
  });

  it("should allow hradmin who is also leader of the same department", () => {
    expect(canApproveWfhRequest({ approverRoles: ["hradmin", "leader"], approverDepartmentId: 3, requesterDepartmentId: 3 })).toBe(true);
    expect(canApproveWfhRequest({ approverRoles: ["hradmin", "leader"], approverDepartmentId: 3, requesterDepartmentId: 4 })).toBe(false);
  });
});

describe("hradmin user management", () => {
  const base = { targetCurrentRoles: ["staff"], nextRoles: [], superadminCount: 2 } as const;

  it("should let hradmin assign hradmin and leader", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["hradmin"], nextRoles: ["leader", "hradmin"] })).toBeNull();
  });

  it("should forbid hradmin from granting or revoking itadmin and superadmin", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["hradmin"], nextRoles: ["itadmin"] })).not.toBeNull();
    expect(validateRoleChange({ ...base, actorRoles: ["hradmin"], nextRoles: ["superadmin"] })).not.toBeNull();
    expect(
      validateRoleChange({ ...base, actorRoles: ["hradmin"], targetCurrentRoles: ["itadmin"], nextRoles: [] }),
    ).not.toBeNull();
  });

  it("should let hradmin change other roles while keeping itadmin unchanged", () => {
    expect(
      validateRoleChange({ ...base, actorRoles: ["hradmin"], targetCurrentRoles: ["itadmin"], nextRoles: ["itadmin", "leader"] }),
    ).toBeNull();
  });

  it("should still let itadmin grant itadmin", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["itadmin"], nextRoles: ["itadmin"] })).toBeNull();
  });

  it("should list grantable roles per actor", () => {
    expect(getGrantableRoles(["hradmin"])).toEqual(["hradmin", "leader"]);
    expect(getGrantableRoles(["itadmin"])).toEqual(["itadmin", "hradmin", "leader"]);
    expect(getGrantableRoles(["superadmin"])).toHaveLength(4);
    expect(getGrantableRoles(["leader"])).toEqual([]);
  });

  it("should block hradmin from managing accounts with privileged roles", () => {
    expect(canManageAccount(["hradmin"], ["leader"])).toBe(true);
    expect(canManageAccount(["hradmin"], ["itadmin"])).toBe(false);
    expect(canManageAccount(["hradmin"], ["superadmin"])).toBe(false);
    expect(canManageAccount(["itadmin"], ["itadmin"])).toBe(true);
    expect(canManageAccount(["itadmin"], ["superadmin"])).toBe(false);
    expect(canManageAccount(["leader"], ["staff"])).toBe(false);
  });

  it("should show user and department menus to hradmin", () => {
    const hrefs = getAdminNavigation(["hradmin"]).map((item) => item.href);
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/departments");
    expect(hrefs).not.toContain("/admin/settings");
  });
});

describe("resolveAttendanceReportScope", () => {
  it("should let HR roles pick any department or all", () => {
    expect(resolveAttendanceReportScope({ roles: ["hradmin"], ownDepartmentId: 1, requestedDepartmentId: 5 })).toEqual({ departmentId: 5 });
    expect(resolveAttendanceReportScope({ roles: ["superadmin"], ownDepartmentId: null })).toEqual({ departmentId: undefined });
  });

  it("should force leaders to their own department", () => {
    expect(resolveAttendanceReportScope({ roles: ["leader"], ownDepartmentId: 3, requestedDepartmentId: 9 })).toEqual({ departmentId: 3 });
    expect(resolveAttendanceReportScope({ roles: ["leader"], ownDepartmentId: 3 })).toEqual({ departmentId: 3 });
  });

  it("should reject leaders without a department and other roles", () => {
    expect(resolveAttendanceReportScope({ roles: ["leader"], ownDepartmentId: null })).toHaveProperty("error");
    expect(resolveAttendanceReportScope({ roles: ["itadmin"], ownDepartmentId: 1 })).toHaveProperty("error");
    expect(resolveAttendanceReportScope({ roles: ["staff"], ownDepartmentId: 1 })).toHaveProperty("error");
  });

  it("should show the attendance report menu to leaders only", () => {
    expect(getAdminNavigation(["leader"]).map((item) => item.href)).toEqual(["/admin/attendance"]);
  });
});
