import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = await AuthService.getUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await AuthService.updatePassword(userId, password);

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update security keys" }, { status: 500 });
  }
}
