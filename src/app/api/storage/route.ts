import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { StorageService } from "@/services/StorageService";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usage = await StorageService.getStorageUsage(userId);
    return NextResponse.json(usage);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
