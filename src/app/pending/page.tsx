import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PendingScreen } from "./pending-screen";

export default async function PendingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.status === "active") {
    redirect("/");
  }

  return <PendingScreen initialName={session.user.name ?? "ผู้ใช้งาน"} />;
}
