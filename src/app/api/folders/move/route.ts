import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FolderService } from "@/services/FolderService";

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, parentId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Folder ID (id) is required" }, { status: 400 });
    }

    // parentId can be null to move to root
    const updatedFolder = await FolderService.moveFolder(userId, id, parentId);
    return NextResponse.json(updatedFolder);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
