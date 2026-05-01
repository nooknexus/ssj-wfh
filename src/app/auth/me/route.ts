import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  if (!Number.isInteger(userId)) {
    return Response.json({ error: "Invalid session" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name_eng: true,
      name_th: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name_th ?? user.name_eng ?? "ไม่ระบุชื่อ",
      role: user.role,
      status: user.status,
    },
  });
}
