import { describe, expect, it } from "vitest";
import { mergeRecentRequests } from "./recent-requests";

const d = (value: string) => new Date(`2026-11-${value}`);

describe("mergeRecentRequests", () => {
  const exceptions = [
    { id: 1, type: "official_trip" as const, date: d("24T00:00:00Z"), period: "full" as const, status: "approved" as const, created_at: d("18T09:00:00") },
    { id: 2, type: "leave" as const, date: d("25T00:00:00Z"), period: "morning" as const, status: "pending" as const, created_at: d("20T08:00:00") },
  ];
  const wfh = [
    { id: 7, start_date: d("26T00:00:00Z"), end_date: d("27T00:00:00Z"), status: "rejected" as const, created_at: d("19T10:00:00") },
  ];

  it("should merge both sources newest first and label each kind", () => {
    expect(mergeRecentRequests(exceptions, wfh, 5)).toEqual([
      { key: "exception-2", kind: "leave", startDate: exceptions[1].date, endDate: exceptions[1].date, period: "morning", status: "pending", createdAt: exceptions[1].created_at },
      { key: "wfh-7", kind: "wfh", startDate: wfh[0].start_date, endDate: wfh[0].end_date, period: null, status: "rejected", createdAt: wfh[0].created_at },
      { key: "exception-1", kind: "official_trip", startDate: exceptions[0].date, endDate: exceptions[0].date, period: "full", status: "approved", createdAt: exceptions[0].created_at },
    ]);
  });

  it("should keep only the newest items up to the limit", () => {
    expect(mergeRecentRequests(exceptions, wfh, 2).map((item) => item.key)).toEqual(["exception-2", "wfh-7"]);
  });

  it("should return an empty list when there is nothing", () => {
    expect(mergeRecentRequests([], [], 3)).toEqual([]);
  });
});
