import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.status === "pending") {
    redirect("/pending");
  }

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden">
      <Sidebar/>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:pl-[300px]">
        <Header/>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 focus:outline-none">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
