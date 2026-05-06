import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: string;
      status?: string;
      name_th?: string;
    };
  }

  interface User {
    id: string;
    role?: string;
    status?: string;
    name_th?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    status?: string;
    name_th?: string;
  }
}
