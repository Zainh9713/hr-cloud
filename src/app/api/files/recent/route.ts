import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import FileModel from "@/models/File";
import connectDB from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const files = await FileModel.find({ 
      ownerId: userId, 
      isTrash: { $ne: true } 
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
