import { describe, expect, it } from "vitest";
import { isManualLocationAllowed } from "./attendance-utils";

describe("isManualLocationAllowed", () => {
  it("should return true when setting is undefined or null", () => {
    expect(isManualLocationAllowed(undefined)).toBe(true);
    expect(isManualLocationAllowed(null)).toBe(true);
  });

  it("should return true when setting is 'true'", () => {
    expect(isManualLocationAllowed("true")).toBe(true);
    expect(isManualLocationAllowed("TRUE")).toBe(true);
  });

  it("should return false when setting is 'false'", () => {
    expect(isManualLocationAllowed("false")).toBe(false);
    expect(isManualLocationAllowed("FALSE")).toBe(false);
  });

  it("should return true for any other non-false string value", () => {
    expect(isManualLocationAllowed("1")).toBe(true);
    expect(isManualLocationAllowed("enabled")).toBe(true);
  });
});
