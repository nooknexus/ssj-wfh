"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDayList, type MonthlyReportRow, type ReportColumn } from "@/lib/attendance-report";
import { trpc } from "@/trpc/client";

const MIN_ROWS = 10;

/** รอให้ฟอนต์ Sarabun โหลดครบก่อนเปิดหน้าต่างพิมพ์ ไม่เช่นนั้นเบราว์เซอร์อาจใช้ฟอนต์สำรอง */
const printWhenFontsReady = async () => {
  await document.fonts.ready;
  window.print();
};

/** คอลัมน์ตามฟอร์ม: [หัวข้อ, คอลัมน์ข้อมูล] แต่ละคอลัมน์มีช่อง (วันที่) และ รวม (วัน) */
const COLUMN_GROUPS: Array<[string, ReportColumn]> = [
  ["ลาพักผ่อน", "vacation"],
  ["ลาป่วย", "sick"],
  ["ลากิจ", "personal"],
  ["ไปราชการ", "officialTrip"],
  ["มาสาย", "late"],
  ["ไม่สแกนเข้า", "noCheckIn"],
];

const formatTotal = (total: number) => (total ? String(total) : "");

const cell = "border border-black px-1 py-0.5 align-top";
const head = "border border-black px-1 py-0.5 text-center align-middle font-semibold";

type Row = MonthlyReportRow & { userId: number; name: string };

const ReportRow = ({ index, row }: { index: number; row?: Row }) => (
  <tr className="h-7 break-inside-avoid">
    <td className={`${cell} text-center`}>{index}</td>
    <td className={`${cell} whitespace-nowrap`}>{row?.name ?? ""}</td>
    {COLUMN_GROUPS.map(([, key]) => (
      <ColumnCells key={key} days={row?.columns[key].days} total={row?.columns[key].total} />
    ))}
    <td className={cell}>{row ? formatDayList(row.noCheckOutDays) : ""}</td>
    <td className={cell} />
    <td className={`${cell} text-[10px]`}>{row?.remark ?? ""}</td>
  </tr>
);

const ColumnCells = ({ days, total }: { days?: number[]; total?: number }) => (
  <>
    <td className={cell}>{days ? formatDayList(days) : ""}</td>
    <td className={`${cell} text-center`}>{total ? formatTotal(total) : ""}</td>
  </>
);

const ReportHead = () => (
  <thead className="table-header-group">
    <tr>
      <th rowSpan={2} className={`${head} w-8 whitespace-nowrap`}>ลำดับที่</th>
      <th rowSpan={2} className={`${head} min-w-[140px]`}>ชื่อ - นามสกุล</th>
      {COLUMN_GROUPS.map(([label]) => (
        <SubHead key={label} label={label} />
      ))}
      <th className={`${head} min-w-[72px] whitespace-nowrap`}>ไม่สแกนออก</th>
      <th className={head}>เซ็นชื่อ</th>
      <th rowSpan={2} className={`${head} min-w-[90px]`}>หมายเหตุ</th>
    </tr>
    <tr>
      {COLUMN_GROUPS.map(([label]) => (
        <SubHeadUnits key={label} />
      ))}
      <th className={head}>(วันที่)</th>
      <th className={`${head} min-w-[70px]`}>รับทราบ</th>
    </tr>
  </thead>
);

const SubHead = ({ label }: { label: string }) => (
  <>
    <th className={`${head} min-w-[72px] whitespace-nowrap`}>{label}</th>
    <th className={`${head} w-9`}>รวม</th>
  </>
);

const SubHeadUnits = () => (
  <>
    <th className={head}>(วันที่)</th>
    <th className={head}>(วัน)</th>
  </>
);

export const MonthlyReportSheet = ({ month, departmentId }: { month: string; departmentId?: number }) => {
  const { data, isLoading, error } = trpc.attendance.getMonthlyReport.useQuery({ month, departmentId }, { retry: false });
  const rows: Array<Row | undefined> = [...(data?.rows ?? [])];
  while (rows.length < MIN_ROWS) rows.push(undefined);

  return (
    <>
      <style>{`@page { size: A4 landscape; margin: 8mm 6mm; } @media print { html, body { background: #fff; } }`}</style>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white px-4 py-3 shadow-sm print:hidden">
        <Link href="/admin/attendance">
          <Button variant="outline" size="sm"><ArrowLeft className="mr-1.5 h-4 w-4" />กลับ</Button>
        </Link>
        <p className="hidden text-sm text-slate-500 sm:block">กดพิมพ์ แล้วเลือกปลายทาง &quot;บันทึกเป็น PDF&quot; (Save as PDF) และแนวกระดาษแนวนอน</p>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={!data} onClick={printWhenFontsReady}>
          <Printer className="mr-1.5 h-4 w-4" />พิมพ์ / บันทึกเป็น PDF
        </Button>
      </div>

      <div className="mx-auto my-6 w-[297mm] max-w-full bg-white p-[8mm] text-[11.5px] leading-snug text-black shadow print:my-0 print:w-auto print:p-0 print:shadow-none">
        {isLoading ? (
          <p className="py-20 text-center text-sm text-slate-500">กำลังเตรียมรายงาน...</p>
        ) : error ? (
          <p className="py-20 text-center text-sm text-rose-600">{error.message}</p>
        ) : data ? (
          <>
            <header className="mb-2 space-y-0.5 text-center text-[15px] font-semibold">
              <h1 className="text-[18px] font-bold">แบบรายงานการลงเวลาปฏิบัติราชการของเจ้าหน้าที่</h1>
              <p>{data.departmentName}</p>
              <p>ประจำเดือน {data.monthLabel}</p>
            </header>
            <table className="w-full border-collapse">
              <ReportHead />
              <tbody>
                {rows.map((row, index) => (
                  <ReportRow key={row?.userId ?? `blank-${index}`} index={index + 1} row={row} />
                ))}
              </tbody>
            </table>
            <PersonnelSummary personnel={data.personnel} />
          </>
        ) : null}
      </div>
    </>
  );
};

type Personnel = { rows: Array<{ label: string; count: number }>; total: number; available: boolean };

const PersonnelSummary = ({ personnel }: { personnel: Personnel }) => (
  <div className="mt-4 flex break-inside-avoid items-end justify-between gap-6 text-[12.5px]">
    <table>
      <tbody>
        {personnel.rows.map((row) => (
          <tr key={row.label}>
            <td className="pr-6">{row.label}</td>
            <td>จำนวน {personnel.available ? row.count : "........"} คน</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className="pr-6">รวม</td>
          <td>จำนวน {personnel.total} คน</td>
        </tr>
      </tbody>
    </table>
    <div className="space-y-6 text-center">
      {!personnel.available ? <p className="text-[9px] text-slate-500 print:hidden">ดึงประเภทบุคลากรจากระบบลาไม่สำเร็จ</p> : null}
      <p>ลงชื่อ ............................................................ ผู้รายงาน</p>
      <p>(............................................................)</p>
    </div>
  </div>
);
