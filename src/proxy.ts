import { withAuth } from "next-auth/middleware";

const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => Boolean(token?.id),
  },
  pages: {
    signIn: "/login",
  },
});

export const proxy = authMiddleware;
export default authMiddleware;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
