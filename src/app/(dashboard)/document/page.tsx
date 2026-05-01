"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/trpc/client";
import { FileText, Inbox, Send, FileSignature, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ModuleGuard } from "@/components/layout/module-guard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";

export default function DocumentDashboard() {
  const { data: stats, isLoading } = trpc.document.getStats.useQuery();

  const mockChartData = [
    { name: 'ม.ค.', inbound: 40, outbound: 24, order: 10, memo: 15 },
    { name: 'ก.พ.', inbound: 30, outbound: 13, order: 5, memo: 20 },
    { name: 'มี.ค.', inbound: 20, outbound: 38, order: 8, memo: 10 },
    { name: 'เม.ย.', inbound: 27, outbound: 39, order: 12, memo: 25 },
    { name: 'พ.ค.', inbound: 18, outbound: 48, order: 4, memo: 18 },
    { name: 'มิ.ย.', inbound: 23, outbound: 38, order: 6, memo: 22 },
  ];

  const cards = [
    {
      title: "หนังสือรับ",
      value: isLoading ? "..." : stats?.inbound || 0,
      icon: Inbox,
      gradient: "from-blue-500 to-cyan-400",
      link: "/document/inbound"
    },
    {
      title: "หนังสือส่ง",
      value: isLoading ? "..." : stats?.outbound || 0,
      icon: Send,
      gradient: "from-purple-500 to-pink-500",
      link: "/document/outbound"
    },
    {
      title: "คำสั่ง",
      value: isLoading ? "..." : stats?.order || 0,
      icon: FileSignature,
      gradient: "from-amber-500 to-orange-400",
      link: "/document/orders"
    },
    {
      title: "บันทึกข้อความ",
      value: isLoading ? "..." : stats?.memo || 0,
      icon: FileText,
      gradient: "from-emerald-500 to-teal-400",
      link: "/document/memos"
    },
    {
      title: "รอดำเนินการ",
      value: isLoading ? "..." : stats?.pending || 0,
      icon: Clock,
      gradient: "from-rose-500 to-red-400",
      link: "/document/inbound"// Usually pending are inbound
    }
  ];

  return (
    <ModuleGuard moduleKey="module_document">
      <div className="space-y-6">
        {/* ... existing content ... */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ระบบงานสารบรรณ</h1>
            <p className="text-slate-500 mt-1">จัดการหนังสือรับ-ส่ง คำสั่ง และบันทึกข้อความ</p>
          </div>
          <div className="flex gap-2">
            <Link href="/document/inbound?new=true">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Inbox className="w-4 h-4 mr-2"/>
                รับหนังสือใหม่
              </Button>
            </Link>
          </div>
        </div>

        {/* 5-Column Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {cards.map((card, index) => (
            <Link key={index} href={card.link}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden border-none shadow-sm relative group">
                <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${card.gradient}`}/>
                <div className={`absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 rounded-full bg-gradient-to-br ${card.gradient} opacity-20 group-hover:scale-150 transition-transform duration-500 ease-out`}/>
                <CardHeader className="flex flex-row items-center justify-between pb-2 z-10 relative">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {card.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient} text-white shadow-sm`}>
                    <card.icon className="h-4 w-4"/>
                  </div>
                </CardHeader>
                <CardContent className="z-10 relative">
                  <div className="text-3xl font-bold text-slate-800">{card.value}</div>
                  <div className="flex items-center text-xs text-slate-500 mt-2">
                    <span className="flex items-center text-blue-600 hover:underline">
                      ดูรายการ <ExternalLink className="w-3 h-3 ml-1"/>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="col-span-2 shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-blue-600"/>
                สถิติการรับ-ส่งเอกสารรายเดือน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }}/>
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/ 0.1)' }}
                   />
                    <Bar dataKey="inbound" name="หนังสือรับ" fill="#3b82f6" radius={[4, 4, 0, 0]}/>
                    <Bar dataKey="outbound" name="หนังสือส่ง" fill="#a855f7" radius={[4, 4, 0, 0]}/>
                    <Bar dataKey="order" name="คำสั่ง" fill="#f59e0b" radius={[4, 4, 0, 0]}/>
                    <Bar dataKey="memo" name="บันทึกข้อความ" fill="#10b981" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions/ Recent Activity */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">เมนูด่วน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/document/inbound?new=true" className="flex items-center p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-100 transition-colors group">
                <div className="bg-blue-100 p-2 rounded-md text-blue-600 group-hover:bg-blue-200 transition-colors">
                  <Inbox className="w-5 h-5"/>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">ลงทะเบียนหนังสือรับ</p>
                  <p className="text-xs text-slate-500">บันทึกหนังสือเข้าใหม่</p>
                </div>
              </Link>
              
              <Link href="/document/outbound?new=true" className="flex items-center p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-purple-50 hover:border-purple-100 transition-colors group">
                <div className="bg-purple-100 p-2 rounded-md text-purple-600 group-hover:bg-purple-200 transition-colors">
                  <Send className="w-5 h-5"/>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900 group-hover:text-purple-700">ลงทะเบียนหนังสือส่ง</p>
                  <p className="text-xs text-slate-500">ออกเลขหนังสือส่ง</p>
                </div>
              </Link>

              <Link href="/document/orders?new=true" className="flex items-center p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-amber-50 hover:border-amber-100 transition-colors group">
                <div className="bg-amber-100 p-2 rounded-md text-amber-600 group-hover:bg-amber-200 transition-colors">
                  <FileSignature className="w-5 h-5"/>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-900 group-hover:text-amber-700">ออกคำสั่ง/ประกาศ</p>
                  <p className="text-xs text-slate-500">บันทึกคำสั่งใหม่</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </ModuleGuard>
  );
}
