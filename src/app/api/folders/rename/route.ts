import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FolderService } from "@/services/FolderService";

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, newName } = await request.json();
    if (!id || !newName) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const folder = await FolderService.updateFolder(userId, id, { name: newName });

    return NextResponse.json({ message: "Folder renamed", folder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
