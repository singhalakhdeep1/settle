import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { LoginSchema } from "@payflow/shared";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            orgId: string;
            role: string;
        };
        accessToken: string;
    }

    interface User {
        id: string;
        email: string;
        name: string;
        orgId: string;
        role: string;
        accessToken: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        orgId: string;
        role: string;
        accessToken: string;
    }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { type: "email" },
                password: { type: "password" },
            },
            async authorize(credentials) {
                const parsed = LoginSchema.safeParse(credentials);
                if (!parsed.success) return null;

                const res = await fetch(`${API_URL}/v1/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(parsed.data),
                });

                if (!res.ok) return null;
                const { user, accessToken } = (await res.json()) as {
                    user: { id: string; email: string; fullName: string; orgId: string; role: string };
                    accessToken: string;
                };

                return {
                    id: user.id,
                    email: user.email,
                    name: user.fullName,
                    orgId: user.orgId,
                    role: user.role,
                    accessToken,
                };
            },
        }),
    ],
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.orgId = (user as User).orgId;
                token.role = (user as User).role;
                token.accessToken = (user as User).accessToken;
            }
            return token;
        },
        session({ session, token }) {
            session.user.id = token.sub!;
            session.user.orgId = token.orgId;
            session.user.role = token.role;
            session.accessToken = token.accessToken;
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
});
