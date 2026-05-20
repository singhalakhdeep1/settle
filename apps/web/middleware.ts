import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth?: unknown }) => {
    const isAuthenticated = !!(req as NextRequest & { auth?: { user?: unknown } }).auth?.user;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

    if (!isAuthenticated && !isAuthPage) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    if (isAuthenticated && isAuthPage) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
    ],
};
