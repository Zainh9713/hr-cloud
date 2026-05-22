import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FolderService } from "@/services/FolderService";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId") || null;

    // Check if we want a full tree or flat listing
    const isTree = searchParams.get("tree") === "true";
    let folders;
    let totalCount = 0;
    if (isTree) {
      folders = await FolderService.getAllFoldersForUser(userId);
      totalCount = folders.length;
    } else {
      const pageStr = searchParams.get("page");
      const limitStr = searchParams.get("limit");
      const page = pageStr ? parseInt(pageStr, 10) : undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;
      
      const res = await FolderService.getFolders(userId, parentId, page, limit);
      folders = res.folders;
      totalCount = res.totalCount;
    }

    return NextResponse.json({ folders, totalCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, parentId, color, icon } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const folder = await FolderService.createFolder(userId, name, parentId, color, icon);
    return NextResponse.json(folder);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, color, icon, isStarred, isTrash } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    const folder = await FolderService.updateFolder(userId, id, {
      name,
      color,
      icon,
      isStarred,
      isTrash
    });

    return NextResponse.json(folder);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Folder ID required" }, { status: 400 });
    }

    await FolderService.updateFolder(userId, id, { isTrash: true });
    return NextResponse.json({ success: true, message: "Folder and its contents moved to trash" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
