import { NextResponse, type NextFetchEvent } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { OPEN_EXTERNAL_BROWSER_PARAM, shouldOpenExternalBrowser } from "@/lib/line-browser";

const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => Boolean(token?.id),
  },
  pages: {
    signIn: "/login",
  },
});

export default function proxy(request: NextRequestWithAuth, event: NextFetchEvent) {
  // เปิดลิงก์จาก LINE: ให้ LINE เปิดหน้าเดิมใน browser ภายนอก (GPS และ SSO ใน browser ของ LINE ใช้งานได้ไม่ดี)
  if (shouldOpenExternalBrowser(request.method, request.headers.get("user-agent"), request.nextUrl.searchParams)) {
    const url = request.nextUrl.clone();
    url.searchParams.set(OPEN_EXTERNAL_BROWSER_PARAM, "1");
    return NextResponse.redirect(url);
  }

  // หน้า login เข้าได้โดยไม่ต้องล็อกอิน (ผ่าน proxy เพื่อให้เช็ก LINE ด้านบนเท่านั้น)
  if (request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  return authMiddleware(request, event);
}

export { proxy };

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
