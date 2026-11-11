import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accuracyLevel, getDevicePlatform, isLikelyNetworkFix, sampleBestPosition, type PositionFix } from "./geolocation";

const position = (lat: number, accuracy: number) =>
  ({ coords: { latitude: lat, longitude: 100, accuracy } }) as GeolocationPosition;

const fakeGeolocation = () => {
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback | null | undefined;
  const geolocation = {
    watchPosition: vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
      success = onSuccess;
      failure = onError;
      return 7;
    }),
    clearWatch: vi.fn(),
  };
  return {
    geolocation,
    emit: (lat: number, accuracy: number) => success(position(lat, accuracy)),
    fail: (code: number) => failure?.({ code, PERMISSION_DENIED: 1, message: `error ${code}` } as GeolocationPositionError),
  };
};

describe("accuracyLevel", () => {
  it("should grade accuracy as good, fair or poor", () => {
    expect(accuracyLevel(15)).toBe("good");
    expect(accuracyLevel(30)).toBe("good");
    expect(accuracyLevel(80)).toBe("fair");
    expect(accuracyLevel(250)).toBe("poor");
  });
});

describe("sampleBestPosition", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("should keep only fixes that are more accurate than the best so far", () => {
    const { geolocation, emit } = fakeGeolocation();
    const progress: PositionFix[] = [];
    sampleBestPosition(geolocation, { onProgress: (fix) => progress.push(fix), onDone: vi.fn() });

    emit(1, 300);
    emit(2, 500);
    emit(3, 80);

    expect(progress.map((fix) => fix.accuracy)).toEqual([300, 80]);
  });

  it("should stop as soon as a fix is accurate enough", () => {
    const { geolocation, emit } = fakeGeolocation();
    const onDone = vi.fn();
    sampleBestPosition(geolocation, { onProgress: vi.fn(), onDone });

    emit(1, 200);
    emit(2, 25);

    expect(onDone).toHaveBeenCalledWith({ lat: 2, lng: 100, accuracy: 25 }, null);
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
  });

  it("should settle for the best fix when time runs out", () => {
    const { geolocation, emit } = fakeGeolocation();
    const onDone = vi.fn();
    sampleBestPosition(geolocation, { onProgress: vi.fn(), onDone }, { timeoutMs: 10_000 });

    emit(1, 400);
    emit(2, 90);
    vi.advanceTimersByTime(10_000);

    expect(onDone).toHaveBeenCalledWith({ lat: 2, lng: 100, accuracy: 90 }, null);
  });

  it("should report the last error when no fix arrives in time", () => {
    const { geolocation, fail } = fakeGeolocation();
    const onDone = vi.fn();
    sampleBestPosition(geolocation, { onProgress: vi.fn(), onDone }, { timeoutMs: 10_000 });

    fail(2);
    vi.advanceTimersByTime(10_000);

    expect(onDone).toHaveBeenCalledWith(null, expect.objectContaining({ code: 2 }));
  });

  it("should give up immediately when permission is denied", () => {
    const { geolocation, fail } = fakeGeolocation();
    const onDone = vi.fn();
    sampleBestPosition(geolocation, { onProgress: vi.fn(), onDone });

    fail(1);

    expect(onDone).toHaveBeenCalledWith(null, expect.objectContaining({ code: 1 }));
    expect(geolocation.clearWatch).toHaveBeenCalled();
  });

  it("should finish only once and ignore readings after it is stopped", () => {
    const { geolocation, emit } = fakeGeolocation();
    const onDone = vi.fn();
    const onProgress = vi.fn();
    const stop = sampleBestPosition(geolocation, { onProgress, onDone });

    stop();
    emit(1, 10);
    vi.advanceTimersByTime(20_000);

    expect(onProgress).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("sampleBestPosition with a synchronous reading", () => {
  it("should clean up even when an accurate fix arrives inside watchPosition", () => {
    const geolocation = {
      watchPosition: vi.fn((onSuccess: PositionCallback) => {
        onSuccess(position(5, 10));
        return 3;
      }),
      clearWatch: vi.fn(),
    };
    const onDone = vi.fn();
    sampleBestPosition(geolocation, { onProgress: vi.fn(), onDone });

    expect(onDone).toHaveBeenCalledWith({ lat: 5, lng: 100, accuracy: 10 }, null);
    expect(geolocation.clearWatch).toHaveBeenCalledWith(3);
  });
});

describe("isLikelyNetworkFix", () => {
  it("should flag fixes too coarse to come from GPS", () => {
    expect(isLikelyNetworkFix(15)).toBe(false);
    expect(isLikelyNetworkFix(100)).toBe(false);
    expect(isLikelyNetworkFix(101)).toBe(true);
    expect(isLikelyNetworkFix(2500)).toBe(true);
  });
});

describe("getDevicePlatform", () => {
  it("should tell iOS, Android and other devices apart", () => {
    expect(getDevicePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari Line/14.10.0")).toBe("ios");
    expect(getDevicePlatform("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15")).toBe("ios");
    expect(getDevicePlatform("Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/129.0 Mobile Safari/537.36")).toBe("android");
    expect(getDevicePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0")).toBe("other");
  });
});

describe("getDevicePlatform for iPads in desktop mode", () => {
  it("should treat a touch-capable Macintosh as iOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";
    expect(getDevicePlatform(ua, 5)).toBe("ios");
    expect(getDevicePlatform(ua, 0)).toBe("other");
  });
});
