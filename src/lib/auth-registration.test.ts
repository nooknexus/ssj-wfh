import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  systemSetting: { findFirst: vi.fn() },
}));
const notify = vi.hoisted(() => ({ sendMorPromNotify: vi.fn(), buildNewUserFlex: vi.fn((info) => ({ info })) }));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/lib/morprom-notify", () => notify);
vi.mock("@/lib/thaid", () => ({ authenticateWithThaiD: vi.fn() }));
vi.mock("@/lib/sso", () => ({
  authenticateWithMOPH: vi.fn().mockResolvedValue({
    providerId: "P1",
    username: "1234567890123",
    nameTh: "ทดสอบ ระบบ",
    titleTh: "นาย",
    position: "นักวิชาการคอมพิวเตอร์",
    hname: "สสจ.พิษณุโลก",
  }),
}));

import { authOptions } from "./auth";

type Authorize = (credentials: Record<string, string>) => Promise<unknown>;
const authorizeMoph = (authOptions.providers[0] as unknown as { options: { authorize: Authorize } }).options.authorize;

const savedUser = { id: 5, name_th: "ทดสอบ ระบบ", name_eng: null, title_th: "นาย", email: null, status: "pending", position: "นักวิชาการคอมพิวเตอร์", hname: "สสจ.พิษณุโลก" };

describe("MOPH sign-in registration notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.systemSetting.findFirst.mockResolvedValue(null);
  });

  it("notifies admins when a new user registers", async () => {
    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockResolvedValue(savedUser);

    await authorizeMoph({ code: "abc" });

    expect(notify.sendMorPromNotify).toHaveBeenCalledTimes(1);
    expect(notify.buildNewUserFlex).toHaveBeenCalledWith(
      expect.objectContaining({ nameTh: "ทดสอบ ระบบ", position: "นักวิชาการคอมพิวเตอร์", hname: "สสจ.พิษณุโลก" }),
    );
  });

  it("does not notify when an existing user signs in again", async () => {
    db.user.findFirst.mockResolvedValue({ id: 5 });
    db.user.update.mockResolvedValue({ ...savedUser, status: "active" });

    await authorizeMoph({ code: "abc" });

    expect(notify.sendMorPromNotify).not.toHaveBeenCalled();
  });

  it("does not notify when registration is closed", async () => {
    db.user.findFirst.mockResolvedValue(null);
    db.systemSetting.findFirst.mockResolvedValue({ setting_value: "false" });

    await expect(authorizeMoph({ code: "abc" })).rejects.toThrow("registration_disabled");
    expect(notify.sendMorPromNotify).not.toHaveBeenCalled();
  });
});
