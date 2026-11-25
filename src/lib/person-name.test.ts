import { describe, expect, it } from "vitest";
import { formatThaiFullName, splitThaiTitle } from "./person-name";

describe("formatThaiFullName", () => {
  it("should join the title and the name", () => {
    expect(formatThaiFullName("นาย", "ภาณุพงษ์ ดงเย็น")).toBe("นายภาณุพงษ์ ดงเย็น");
  });

  it("should not repeat a title the name already starts with", () => {
    expect(formatThaiFullName("นาย", "นาย นัฐพร สุราษฎร์")).toBe("นายนัฐพร สุราษฎร์");
    expect(formatThaiFullName("นาย", "นายอุเทน จาดยางโทน")).toBe("นายอุเทน จาดยางโทน");
    expect(formatThaiFullName("นาง", "นางสาวกนกพร วุฒิอารีย์")).toBe("นางสาวกนกพร วุฒิอารีย์");
  });

  it("should tidy extra spaces", () => {
    expect(formatThaiFullName(" นาง ", "  นาง   ศิริวรรณ  ภู่สามสาย ")).toBe("นางศิริวรรณ ภู่สามสาย");
  });

  it("should work without a title or a name", () => {
    expect(formatThaiFullName(null, "ธีรยุทธ ยอดบุดดี")).toBe("ธีรยุทธ ยอดบุดดี");
    expect(formatThaiFullName("นาย", null)).toBe("");
    expect(formatThaiFullName(undefined, "  ")).toBe("");
  });
});

describe("splitThaiTitle", () => {
  it("should remove the given title from the start of the name", () => {
    expect(splitThaiTitle("นาย นัฐพร สุราษฎร์", "นาย")).toEqual({ title: "นาย", name: "นัฐพร สุราษฎร์" });
    expect(splitThaiTitle("นางสาวกนกพร วุฒิอารีย์", "นางสาว")).toEqual({ title: "นางสาว", name: "กนกพร วุฒิอารีย์" });
  });

  it("should leave a name without a title untouched", () => {
    expect(splitThaiTitle("ภาณุพงษ์ ดงเย็น", "นาย")).toEqual({ title: "นาย", name: "ภาณุพงษ์ ดงเย็น" });
  });

  it("should detect a common title when none is given, only when followed by a space", () => {
    expect(splitThaiTitle("นางสาว ศิริ ใจดี", undefined)).toEqual({ title: "นางสาว", name: "ศิริ ใจดี" });
    expect(splitThaiTitle("นาง ศิริวรรณ ภู่สามสาย", null)).toEqual({ title: "นาง", name: "ศิริวรรณ ภู่สามสาย" });
    expect(splitThaiTitle("นายิกา ใจดี", undefined)).toEqual({ title: undefined, name: "นายิกา ใจดี" });
  });

  it("should return undefined for an empty name", () => {
    expect(splitThaiTitle(undefined, "นาย")).toEqual({ title: "นาย", name: undefined });
  });
});
