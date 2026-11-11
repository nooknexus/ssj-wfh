export type PositionFix = { lat: number; lng: number; accuracy: number };

/** พิกัดที่คลาดไม่เกินค่านี้ถือว่าแม่นพอ หยุดรอได้ทันที */
export const GOOD_ACCURACY_METERS = 30;
/** เกินค่านี้ถือว่าพิกัดยังไม่น่าเชื่อถือ (มักเป็นตำแหน่งจาก Wi-Fi/เสาสัญญาณในอาคาร) */
export const POOR_ACCURACY_METERS = 100;
/** รอสัญญาณ GPS นานสุดเท่านี้ แล้วใช้พิกัดที่แม่นที่สุดที่ได้ */
export const SAMPLING_TIMEOUT_MS = 10_000;

export type AccuracyLevel = "good" | "fair" | "poor";

export const accuracyLevel = (accuracy: number): AccuracyLevel =>
  accuracy <= GOOD_ACCURACY_METERS ? "good" : accuracy <= POOR_ACCURACY_METERS ? "fair" : "poor";

type Handlers = {
  /** ได้พิกัดที่แม่นกว่าเดิม (เรียกหลายครั้งระหว่างรอ) */
  onProgress: (fix: PositionFix) => void;
  /** จบการรอ: ได้พิกัดที่ดีที่สุด หรือ null พร้อม error ล่าสุด */
  onDone: (fix: PositionFix | null, error: GeolocationPositionError | null) => void;
};

/**
 * พิกัดแรกจาก getCurrentPosition มักเป็นค่าหยาบจาก Wi-Fi/เสาสัญญาณ (คลาดหลายร้อยเมตรในอาคาร)
 * จึงฟังพิกัดต่อเนื่องด้วย watchPosition เก็บค่าที่แม่นที่สุด จนแม่นพอหรือครบเวลา
 * คืนฟังก์ชันสำหรับหยุดรอ (เช่น เมื่อออกจากหน้า)
 */
export const sampleBestPosition = (
  geolocation: Pick<Geolocation, "watchPosition" | "clearWatch">,
  { onProgress, onDone }: Handlers,
  { targetAccuracy = GOOD_ACCURACY_METERS, timeoutMs = SAMPLING_TIMEOUT_MS } = {},
): (() => void) => {
  let best: PositionFix | null = null;
  let lastError: GeolocationPositionError | null = null;
  let finished = false;
  let watchId: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (finished) return;
    finished = true;
    if (timer !== null) clearTimeout(timer);
    if (watchId !== null) geolocation.clearWatch(watchId);
  };
  const finish = () => {
    if (finished) return;
    stop();
    onDone(best, best ? null : lastError);
  };

  watchId = geolocation.watchPosition(
    (position) => {
      if (finished) return;
      const fix = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      if (best && fix.accuracy >= best.accuracy) return;
      best = fix;
      onProgress(fix);
      if (fix.accuracy <= targetAccuracy) finish();
    },
    (error) => {
      if (finished) return;
      lastError = error;
      if (error.code === error.PERMISSION_DENIED) finish();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
  );
  // จบไปแล้วระหว่าง watchPosition (เช่น ได้พิกัดแม่นทันที) ต้องเลิกฟังตอนนี้ เพราะตอนนั้นยังไม่มี watchId
  if (finished) geolocation.clearWatch(watchId);
  else timer = setTimeout(finish, timeoutMs);

  return stop;
};

/**
 * Geolocation API ไม่บอกว่าพิกัดมาจาก GPS หรือจากเครือข่าย (Wi-Fi/เสาสัญญาณ)
 * จึงประเมินจากความคลาดเคลื่อน: GPS มักคลาดไม่เกินหลักสิบเมตร ถ้าเกินนี้มักมาจากเครือข่าย
 * หรือ GPS ถูกปิด / ไม่ได้อนุญาตตำแหน่งแบบแม่นยำ
 */
export const isLikelyNetworkFix = (accuracy: number): boolean => accuracy > POOR_ACCURACY_METERS;

export type DevicePlatform = "ios" | "android" | "other";

/** iPad บางรุ่นรายงานตัวเองเป็น Macintosh จึงดูจำนวนจุดสัมผัสประกอบ */
export const getDevicePlatform = (userAgent: string, maxTouchPoints = 0): DevicePlatform => {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
};
