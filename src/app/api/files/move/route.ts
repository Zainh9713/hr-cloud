import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FileService } from "@/services/FileService";

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, folderId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "File ID (id) is required" }, { status: 400 });
    }

    // folderId can be null to move to root
    const updatedFile = await FileService.moveFile(userId, id, folderId);
    return NextResponse.json(updatedFile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
