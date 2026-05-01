"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search, ChevronLeft, Eye, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function MemosPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: documents, isLoading, refetch } = trpc.document.getDocuments.useQuery({ type: "memo" });
  const deleteDocument = trpc.document.deleteDocument.useMutation({
    onSuccess: () => {
      Swal.fire("ลบสำเร็จ", "ลบเอกสารเรียบร้อยแล้ว", "success");
      refetch();
    },
    onError: (err) => {
      Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
    }
  });

  const handleDelete = (id: number) => {
    Swal.fire({
      title: "ยืนยันการลบ?",
      text: "คุณต้องการลบบันทึกข้อความนี้ใช่หรือไม่ ข้อมูลที่ลบจะไม่สามารถกู้คืนได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ใช่, ลบเลย!",
      cancelButtonText: "ยกเลิก"
    }).then((result) => {
      if (result.isConfirmed) {
        deleteDocument.mutate({ id });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "new": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">บันทึกใหม่</Badge>;
      case "pending": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">รอเกษียน/สั่งการ</Badge>;
      case "in_progress": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">กำลังดำเนินการ</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">เสร็จสิ้น</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDocs = documents?.filter(doc => 
    (doc.subject && doc.subject.includes(searchTerm)) || 
    (doc.doc_number && doc.doc_number.includes(searchTerm)) ||
    (doc.from_to && doc.from_to.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/document">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ChevronLeft className="w-5 h-5"/>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-emerald-600"/>
            บันทึกข้อความภายใน
          </h1>
          <p className="text-slate-500 mt-1">จัดการบันทึกข้อความภายในหน่วยงาน</p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
              <Input 
                placeholder="ค้นหา เลขที่, เรื่อง, จาก..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" onClick={() => Swal.fire('กำลังพัฒนา', 'รอการเชื่อมต่อแบบฟอร์ม', 'info')}>
              <Plus className="w-4 h-4 mr-2"/>
              สร้างบันทึกข้อความ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[120px]">วันที่</TableHead>
                <TableHead className="w-[150px]">เลขที่</TableHead>
                <TableHead>เรื่อง</TableHead>
                <TableHead className="w-[200px]">จาก</TableHead>
                <TableHead className="w-[150px]">สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : filteredDocs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-10 h-10 text-slate-300 mb-2"/>
                      <p>ไม่พบข้อมูลบันทึกข้อความ</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs?.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-600">
                      {doc.doc_date ? format(new Date(doc.doc_date), "dd MMM yy", { locale: th }) : "-"}
                    </TableCell>
                    <TableCell>{doc.doc_number}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={doc.subject || undefined}>
                      {doc.subject}
                    </TableCell>
                    <TableCell className="truncate" title={doc.from_to || undefined}>{doc.from_to}</TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Eye className="h-4 w-4"/>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                          <Edit className="h-4 w-4"/>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
