import { describe, expect, it } from "vitest";
import { isLineInAppBrowser, shouldOpenExternalBrowser } from "./line-browser";

const LINE_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0";
const LINE_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Line/14.10.1/IAB";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("isLineInAppBrowser", () => {
  it("should detect the LINE in-app browser on iOS and Android", () => {
    expect(isLineInAppBrowser(LINE_IOS)).toBe(true);
    expect(isLineInAppBrowser(LINE_ANDROID)).toBe(true);
  });

  it("should not treat other browsers, including Linux user agents, as LINE", () => {
    expect(isLineInAppBrowser(CHROME_ANDROID)).toBe(false);
    expect(isLineInAppBrowser(SAFARI_IOS)).toBe(false);
    expect(isLineInAppBrowser(null)).toBe(false);
    expect(isLineInAppBrowser("")).toBe(false);
  });
});

describe("shouldOpenExternalBrowser", () => {
  const params = (query = "") => new URLSearchParams(query);

  it("should redirect a LINE page request that has not asked for the external browser yet", () => {
    expect(shouldOpenExternalBrowser("GET", LINE_IOS, params("callbackUrl=%2Fattendance"))).toBe(true);
  });

  it("should not redirect again once the parameter is present", () => {
    expect(shouldOpenExternalBrowser("GET", LINE_IOS, params("openExternalBrowser=1"))).toBe(false);
  });

  it("should leave other browsers and non-GET requests alone", () => {
    expect(shouldOpenExternalBrowser("GET", CHROME_ANDROID, params())).toBe(false);
    expect(shouldOpenExternalBrowser("POST", LINE_ANDROID, params())).toBe(false);
  });
});
