import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/server/db";
import { authenticateWithMOPH } from "@/lib/sso";

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function toSessionUser(user: {
  email: string | null;
  id: number;
  name_eng: string | null;
  name_th: string | null;
  role: string;
  status: string;
}) {
  return {
    id: user.id.toString(),
    name: user.name_th ?? user.name_eng ?? "ไม่ระบุชื่อ",
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "moph-sso",
      name: "MOPH ProviderID",
      credentials: {
        code: { label: "Authorization Code", type: "text" },
      },
      async authorize(credentials) {
        const code = credentials?.code?.trim();
        if (!code) return null;

        const profile = await authenticateWithMOPH(code);
        if (!profile.username && !profile.providerId) {
          return null;
        }

        const lookups: Array<
          | { provider_id: string }
          | { username: string }
          | { hash_cid: string }
        > = [];

        if (profile.providerId) {
          lookups.push({ provider_id: profile.providerId });
        }
        if (profile.username) {
          lookups.push({ username: profile.username });
        }
        if (profile.hashCid) {
          lookups.push({ hash_cid: profile.hashCid });
        }

        const existingUser =
          lookups.length > 0
            ? await db.user.findFirst({
                where: {
                  OR: lookups,
                },
              })
            : null;

        const userData = compact({
          provider_id: profile.providerId,
          username: profile.username,
          hash_cid: profile.hashCid,
          name_th: profile.nameTh,
          name_eng: profile.nameEng,
          email: profile.email,
          title_th: profile.titleTh,
          position: profile.position,
          hcode: profile.hcode,
          hname: profile.hname,
        });

        if (!existingUser) {
          const registrationEnabled = await db.systemSetting.findFirst({
            where: { setting_key: "allow_registration" }
          });
          
          if (registrationEnabled?.setting_value === "false") {
            throw new Error("registration_disabled");
          }
        }

        const user = existingUser
          ? await db.user.update({
              where: { id: existingUser.id },
              data: userData,
            })
          : await db.user.create({
              data: {
                ...userData,
                role: "staff",
                status: "pending",
              },
            });

        return toSessionUser(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.name = user.name;
        token.email = user.email;
      }

      if (token.id) {
        const currentUser = await db.user.findUnique({
          where: { id: Number(token.id) },
          select: {
            email: true,
            id: true,
            name_eng: true,
            name_th: true,
            role: true,
            status: true,
          },
        });

        if (currentUser) {
          token.id = currentUser.id.toString();
          token.name = currentUser.name_th ?? currentUser.name_eng ?? token.name;
          token.email = currentUser.email ?? token.email;
          token.role = currentUser.role;
          token.status = currentUser.status;
        }

        // Check session timeout
        const timeoutSetting = await db.systemSetting.findFirst({
          where: { setting_key: "session_timeout" }
        });
        const timeoutMinutes = parseInt(timeoutSetting?.setting_value || "60");
        
        const now = Math.floor(Date.now() / 1000);
        const lastActive = (token.lastActive as number) || (token.iat as number);
        
        if (now - lastActive > timeoutMinutes * 60) {
          return {} as any;
        }
        
        token.lastActive = now;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? session.user.id;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
