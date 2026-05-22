import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { rateLimiter } from "@/lib/middleware/security";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    if (!rateLimiter(ip, 20, 60 * 1000)) { // 20 requests per minute limit
      return NextResponse.json({ error: "Too many requests. Please wait before retrying." }, { status: 429 });
    }

    const { email, password } = await request.json();
    const { token, user } = await AuthService.login(email, password);

    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({
      message: "Logged in",
      user,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
