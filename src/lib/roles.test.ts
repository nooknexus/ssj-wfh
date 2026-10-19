import { describe, expect, it } from "vitest";
import {
  getAdminNavigation,
  getPrimaryRole,
  getRoleLabel,
  getRoleLabels,
  getRoleSummary,
  hasAnyRole,
  hasRole,
  normalizeRoles,
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
  it("should be empty for staff and leader", () => {
    expect(getAdminNavigation(["leader"])).toEqual([]);
  });

  it("should merge menus of multiple roles without duplicates", () => {
    const hrefs = getAdminNavigation(["hradmin", "itadmin"]).map((item) => item.href);
    expect(hrefs).toEqual([
      "/admin/users",
      "/admin/departments",
      "/admin/settings",
      "/admin/attendance",
      "/admin/leaves",
    ]);
  });
});

describe("validateRoleChange", () => {
  const base = { targetCurrentRoles: ["staff"], nextRoles: [], superadminCount: 2 } as const;

  it("should reject actors without user-manager role", () => {
    expect(validateRoleChange({ ...base, actorRoles: ["hradmin"], nextRoles: ["leader"] })).not.toBeNull();
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
