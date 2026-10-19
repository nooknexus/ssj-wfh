import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roles: AppRole[];
      status?: string;
      name_th?: string;
    };
  }

  interface User {
    id: string;
    status?: string;
    name_th?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: AppRole[];
    status?: string;
    name_th?: string;
  }
}
