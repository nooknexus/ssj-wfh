"use client";

import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { WFH_APPROVER_ROLES, hasAnyRole } from "@/lib/roles";

/** ปุ่มไปหน้าอนุมัติคำขอ พร้อมตัวเลขคำขอที่รอผู้ใช้อนุมัติ */
export const ApprovalsButton = () => {
  const { data: session } = useSession();
  const canSeeApprovals = hasAnyRole(session?.user?.roles, WFH_APPROVER_ROLES);
  const { data: counts } = trpc.attendanceException.pendingApprovalCount.useQuery(undefined, {
    enabled: canSeeApprovals,
    refetchInterval: 60_000,
  });

  if (!canSeeApprovals) return null;
  const total = counts?.total ?? 0;

  return (
    <Link href="/wfh/approvals">
      <Button variant="outline" className="relative h-9 border-blue-200 text-blue-700 hover:bg-blue-50">
        <CheckSquare className="w-4 h-4 mr-1.5" />
        การอนุมัติคำขอ
        {total > 0 ? (
          <span
            className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white"
            title={`WFH ${counts?.wfh ?? 0} รายการ, ลา/ไปราชการ ${counts?.exceptions ?? 0} รายการ`}
            aria-label={`มีคำขอรออนุมัติ ${total} รายการ`}
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </Button>
    </Link>
  );
};
