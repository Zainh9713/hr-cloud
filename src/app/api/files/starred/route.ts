import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import FileModel from "@/models/File";
import FolderModel from "@/models/Folder";
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

    const [files, folders] = await Promise.all([
      FileModel.find({ ownerId: userId, isStarred: true, isTrash: { $ne: true } }).sort({ updatedAt: -1 }),
      FolderModel.find({ ownerId: userId, isStarred: true, isTrash: { $ne: true } }).sort({ updatedAt: -1 })
    ]);

    return NextResponse.json({ files, folders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
