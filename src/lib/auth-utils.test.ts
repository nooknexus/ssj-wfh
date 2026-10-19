import { describe, expect, it } from "vitest";
import { isUnauthorizedError } from "./auth-utils";

describe("isUnauthorizedError", () => {
  it("should return false for null, undefined, and non-objects", () => {
    expect(isUnauthorizedError(null)).toBe(false);
    expect(isUnauthorizedError(undefined)).toBe(false);
    expect(isUnauthorizedError("error")).toBe(false);
    expect(isUnauthorizedError(123)).toBe(false);
  });

  it("should return true when data.code is UNAUTHORIZED", () => {
    expect(isUnauthorizedError({ data: { code: "UNAUTHORIZED" } })).toBe(true);
  });

  it("should return true when shape.data.code is UNAUTHORIZED", () => {
    expect(isUnauthorizedError({ shape: { data: { code: "UNAUTHORIZED" } } })).toBe(true);
  });

  it("should return true when data.httpStatus is 401", () => {
    expect(isUnauthorizedError({ data: { httpStatus: 401 } })).toBe(true);
  });

  it("should return true for unauthorized messages", () => {
    expect(isUnauthorizedError({ message: "UNAUTHORIZED" })).toBe(true);
    expect(isUnauthorizedError({ message: "Invalid user session" })).toBe(true);
    expect(isUnauthorizedError({ message: "Invalid session" })).toBe(true);
    expect(isUnauthorizedError({ shape: { message: "UNAUTHORIZED" } })).toBe(true);
  });

  it("should return false for unrelated errors", () => {
    expect(isUnauthorizedError({ data: { code: "NOT_FOUND" } })).toBe(false);
    expect(isUnauthorizedError({ message: "Something went wrong" })).toBe(false);
  });
});
