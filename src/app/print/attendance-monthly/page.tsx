import { MonthlyReportSheet } from "@/components/attendance/monthly-report-sheet";

export const metadata = { title: "แบบรายงานการลงเวลาปฏิบัติราชการ" };

const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AttendanceMonthlyPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const department = Number(pick(params.department));
  return (
    <MonthlyReportSheet
      month={pick(params.month) ?? ""}
      departmentId={Number.isInteger(department) && department > 0 ? department : undefined}
    />
  );
}
