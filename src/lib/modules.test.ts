import { describe, expect, it } from "vitest";
import { filterEnabledNavigation, isModuleEnabled } from "./modules";

describe("isModuleEnabled", () => {
  it("should treat missing settings as enabled", () => {
    expect(isModuleEnabled(undefined, "module_leave")).toBe(true);
    expect(isModuleEnabled({}, "module_leave")).toBe(true);
  });

  it("should disable only when the value is false", () => {
    expect(isModuleEnabled({ module_leave: "false" }, "module_leave")).toBe(false);
    expect(isModuleEnabled({ module_leave: "true" }, "module_leave")).toBe(true);
  });
});

describe("filterEnabledNavigation", () => {
  const items = [{ key: "dashboard" }, { key: "module_leave" }, { key: "module_meeting" }];

  it("should hide disabled modules and keep non-module items", () => {
    expect(filterEnabledNavigation(items, { module_leave: "false" }).map((item) => item.key)).toEqual([
      "dashboard",
      "module_meeting",
    ]);
  });

  it("should toggle every menu that shares a module key together", () => {
    const shared = [
      { key: "dashboard", href: "/" },
      { key: "module_attendance", href: "/attendance" },
      { key: "module_attendance", href: "/weekly-plan" },
    ];
    expect(filterEnabledNavigation(shared, { module_attendance: "false" }).map((item) => item.href)).toEqual(["/"]);
    expect(filterEnabledNavigation(shared, { module_attendance: "true" })).toHaveLength(3);
  });

  it("should show everything while settings are loading", () => {
    expect(filterEnabledNavigation(items, undefined)).toHaveLength(3);
  });
});
