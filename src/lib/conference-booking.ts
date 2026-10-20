export type ConferenceBookingStatus = "pending" | "approved" | "rejected" | "cancelled";

export type BookingInterval = {
  startAt: Date;
  endAt: Date;
};

export type BookingValidationResult =
  | { valid: true }
  | { valid: false; code: "end_before_start" | "duration_too_long" | "start_in_past" | "invalid_attendees" | "capacity_exceeded" };

export const intervalsOverlap = (first: BookingInterval, second: BookingInterval): boolean =>
  first.startAt < second.endAt && second.startAt < first.endAt;

export const blocksAvailability = (status: ConferenceBookingStatus): boolean =>
  status === "pending" || status === "approved";

export const validateBookingRequest = ({
  startAt,
  endAt,
  attendees,
  maxParticipants,
  now = new Date(),
}: BookingInterval & { attendees: number; maxParticipants?: number | null; now?: Date }): BookingValidationResult => {
  if (endAt <= startAt) return { valid: false, code: "end_before_start" };
  if (startAt < now) return { valid: false, code: "start_in_past" };
  if (endAt.getTime() - startAt.getTime() > 8 * 60 * 60 * 1000) return { valid: false, code: "duration_too_long" };
  if (!Number.isInteger(attendees) || attendees < 1) return { valid: false, code: "invalid_attendees" };
  if (maxParticipants != null && attendees > maxParticipants) return { valid: false, code: "capacity_exceeded" };
  return { valid: true };
};

export const getLinkAvailability = ({
  isActive,
  maxParticipants,
  attendees,
  bookings,
  requested,
}: {
  isActive: boolean;
  maxParticipants?: number | null;
  attendees: number;
  bookings: Array<BookingInterval & { status: ConferenceBookingStatus }>;
  requested: BookingInterval;
}): "available" | "inactive" | "capacity_exceeded" | "unavailable" => {
  if (!isActive) return "inactive";
  if (maxParticipants != null && attendees > maxParticipants) return "capacity_exceeded";
  return bookings.some((booking) => blocksAvailability(booking.status) && intervalsOverlap(requested, booking))
    ? "unavailable"
    : "available";
};

export const getHalfHourSlots = (): string[] =>
  Array.from({ length: 27 }, (_, index) => {
    const minutes = 7 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });

export type ConferencePlatform = "zoom" | "teams" | "meet" | "webex" | "other";

export const CONFERENCE_PLATFORMS: ConferencePlatform[] = ["zoom", "teams", "meet", "webex", "other"];

export const PLATFORM_LABELS: Record<ConferencePlatform, string> = {
  zoom: "Zoom",
  teams: "Microsoft Teams",
  meet: "Google Meet",
  webex: "Webex",
  other: "อื่น ๆ",
};

export const BOOKING_STATUS_LABELS: Record<ConferenceBookingStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
};

/** รวมวันที่ (YYYY-MM-DD) กับเวลา (HH:mm) เป็นเวลาท้องถิ่น คืน null ถ้ารูปแบบไม่ถูกต้อง */
export const combineDateTime = (date: string, time: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};
