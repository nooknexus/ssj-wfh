import { describe, expect, it } from "vitest";
import { toProfile } from "./thaid";

describe("ThaiD toProfile", () => {
  it("should keep the title out of name_th when the name claim includes it", () => {
    const profile = toProfile({ pid: "1234567890123", name: "นาย นัฐพร สุราษฎร์", title: "นาย" } as never);
    expect(profile).toMatchObject({ titleTh: "นาย", nameTh: "นัฐพร สุราษฎร์" });
  });

  it("should prefer given and family names", () => {
    const profile = toProfile({ name: "นาย อุเทน จาดยางโทน", given_name: "อุเทน", family_name: "จาดยางโทน", title: "นาย" } as never);
    expect(profile).toMatchObject({ titleTh: "นาย", nameTh: "อุเทน จาดยางโทน" });
  });

  it("should detect the title from the name when the title claim is missing", () => {
    expect(toProfile({ name: "นางสาว กนกพร วุฒิอารีย์" } as never)).toMatchObject({ titleTh: "นางสาว", nameTh: "กนกพร วุฒิอารีย์" });
  });
});
