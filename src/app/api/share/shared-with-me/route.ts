import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import { ShareService } from "@/services/ShareService";
import UserModel from "@/models/User";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token) as { id: string } | null;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const dbUser = await UserModel.findById(user.id);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const sharedLinks = await ShareService.getSharedWithUser(dbUser.email);

    return NextResponse.json({ sharedLinks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
