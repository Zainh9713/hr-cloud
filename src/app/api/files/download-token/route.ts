import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { ShareService } from "@/services/ShareService";
import { generateDownloadToken } from "@/lib/middleware/security";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import UserModel from "@/models/User";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId query parameter is required" }, { status: 400 });
    }

    await connectDB();

    const file = await FileModel.findById(fileId);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const isOwner = file.ownerId.toString() === userId;
    let hasAccess = isOwner;

    if (!isOwner) {
      const user = await UserModel.findById(userId);
      if (user) {
        const shareCheck = await ShareService.isFileSharedWithUser(fileId, user.email);
        if (shareCheck.isShared) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access Denied: You do not have permissions for this file." }, { status: 403 });
    }

    // Generate signed download token using the file's ownerId to allow downstream download execution
    const downloadToken = generateDownloadToken(file.ownerId.toString(), fileId);
    return NextResponse.json({ token: downloadToken });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
