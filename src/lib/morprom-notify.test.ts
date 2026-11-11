import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBookingPendingFlex, buildNewUserFlex, sendMorPromNotify } from "./morprom-notify";

const registeredAt = new Date("2026-11-11T07:35:00.000Z"); // 14:35 น. เวลาไทย

const findText = (node: unknown): string[] => {
  if (!node || typeof node !== "object") return [];
  const record = node as Record<string, unknown>;
  const own = typeof record.text === "string" ? [record.text] : [];
  return [...own, ...Object.values(record).flatMap(findText)];
};

describe("buildNewUserFlex", () => {
  it("should show the title, filled-in details, approval notice and registration time", () => {
    const message = buildNewUserFlex({
      titleTh: "นางสาว",
      nameTh: "ทดสอบ ระบบ",
      position: "นักวิชาการสาธารณสุข",
      hname: "สำนักงานสาธารณสุขจังหวัดพิษณุโลก",
      registeredAt,
    });

    expect(message.type).toBe("flex");
    expect(message.altText).toBe("มีผู้ใช้ใหม่ลงทะเบียน: นางสาวทดสอบ ระบบ");
    expect(findText(message.contents)).toEqual([
      "👤 มีผู้ใช้ใหม่ลงทะเบียน บนระบบ PLK Workspace",
      "คำนำหน้าและชื่อ",
      "นางสาวทดสอบ ระบบ",
      "ตำแหน่ง",
      "นักวิชาการสาธารณสุข",
      "หน่วยงาน",
      "สำนักงานสาธารณสุขจังหวัดพิษณุโลก",
      "⏳ รอผู้ดูแลอนุมัติ",
      "ลงทะเบียนเมื่อ 11 พ.ย. 2569 14:35 น.",
    ]);
  });

  it("should leave out details that are empty and fall back to the English name", () => {
    const texts = findText(buildNewUserFlex({ nameEng: "Test User", position: " ", registeredAt }).contents);

    expect(texts).toContain("Test User");
    expect(texts).not.toContain("ตำแหน่ง");
    expect(texts).not.toContain("หน่วยงาน");
  });

  it("should not contain any button", () => {
    expect(JSON.stringify(buildNewUserFlex({ nameTh: "ก", registeredAt }))).not.toContain('"button"');
  });
});

describe("buildBookingPendingFlex", () => {
  const booking = {
    title: "ประชุมคณะกรรมการ",
    linkName: "Webex 1",
    platform: "webex" as const,
    startAt: new Date("2026-11-12T02:00:00.000Z"), // 09:00 น.
    endAt: new Date("2026-11-12T05:30:00.000Z"), // 12:30 น.
    attendees: 25,
    requesterName: "นายทดสอบ ระบบ",
    departmentName: "กลุ่มงานสุขภาพดิจิทัล",
    bookedAt: registeredAt,
  };

  it("should show the booking details, approval notice and booking time", () => {
    const message = buildBookingPendingFlex(booking);

    expect(message.altText).toBe("มีการจอง Web Conference รออนุมัติ: ประชุมคณะกรรมการ");
    expect(findText(message.contents)).toEqual([
      "📹 มีการจอง Web Conference รออนุมัติ",
      "หัวข้อการประชุม",
      "ประชุมคณะกรรมการ",
      "ลิงก์",
      "Webex 1 (Webex)",
      "วันและเวลา",
      "12 พ.ย. 2569 เวลา 09:00–12:30 น.",
      "จำนวนผู้เข้าร่วม",
      "25 คน",
      "ผู้จอง",
      "นายทดสอบ ระบบ",
      "กลุ่มงาน",
      "กลุ่มงานสุขภาพดิจิทัล",
      "⏳ รอผู้ดูแลอนุมัติ",
      "จองเมื่อ 11 พ.ย. 2569 14:35 น.",
    ]);
  });

  it("should show both dates when the meeting crosses midnight", () => {
    const texts = findText(
      buildBookingPendingFlex({
        ...booking,
        startAt: new Date("2026-11-12T15:00:00.000Z"), // 22:00 น.
        endAt: new Date("2026-11-12T18:00:00.000Z"), // 01:00 น. วันถัดไป
      }).contents,
    );
    expect(texts).toContain("12 พ.ย. 2569 22:00 – 13 พ.ย. 2569 01:00 น.");
  });

  it("should leave out empty details and never include the meeting URL", () => {
    const message = buildBookingPendingFlex({ ...booking, attendees: null, departmentName: null });
    const texts = findText(message.contents);

    expect(texts).not.toContain("จำนวนผู้เข้าร่วม");
    expect(texts).not.toContain("กลุ่มงาน");
    expect(JSON.stringify(message)).not.toContain("webex.com");
  });
});

describe("sendMorPromNotify", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("should skip sending when the keys are not configured", async () => {
    vi.stubEnv("MORPROM_NOTIFY_CLIENT_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendMorPromNotify({ messages: [] })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should post the messages with the client and secret keys", async () => {
    vi.stubEnv("MORPROM_NOTIFY_CLIENT_KEY", "client");
    vi.stubEnv("MORPROM_NOTIFY_SECRET_KEY", "secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 200 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendMorPromNotify({ messages: [{ type: "text", text: "hi" }] })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://morpromt2f.moph.go.th/api/notify/send");
    expect(init.headers).toMatchObject({ "client-key": "client", "secret-key": "secret" });
    expect(JSON.parse(init.body)).toEqual({ messages: [{ type: "text", text: "hi" }] });
  });

  it("should report failure instead of throwing when the API rejects the request", async () => {
    vi.stubEnv("MORPROM_NOTIFY_CLIENT_KEY", "client");
    vi.stubEnv("MORPROM_NOTIFY_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendMorPromNotify({ messages: [] })).toBe(false);
  });
});
