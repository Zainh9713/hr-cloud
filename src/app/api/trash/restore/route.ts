import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import Folder, { IFolder } from "@/models/Folder";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token) as { id: string } | null;
}

// Recursively restores all parent folders in the chain if they are in trash
async function restoreParentFolders(userId: string, folderId: string) {
  let currentId: string | null = folderId;
  while (currentId) {
    const parentFolder = (await Folder.findOne({ _id: currentId, ownerId: userId })) as IFolder | null;
    if (!parentFolder) break;
    
    if (parentFolder.isTrash) {
      parentFolder.isTrash = false;
      parentFolder.deletedAt = null;
      await parentFolder.save();
    }
    
    currentId = parentFolder.parentId ? parentFolder.parentId.toString() : null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, type } = await request.json();
    if (!id || !type) return NextResponse.json({ error: "ID and type required" }, { status: 400 });

    await connectDB();

    if (type === "file") {
      const file = await FileModel.findOne({ _id: id, ownerId: user.id });
      if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
      
      file.isTrash = false;
      file.deletedAt = null;
      await file.save();

      // Recursive ancestor safety restoration
      if (file.parentFolderId) {
        await restoreParentFolders(user.id, file.parentFolderId.toString());
      }

      const ActivityLog = (await import("@/models/ActivityLog")).default;
      await ActivityLog.create({
        userId: user.id,
        action: "RESTORE",
        details: `Restored file from trash: ${file.originalName}`
      });
    } else if (type === "folder") {
      const folder = await Folder.findOne({ _id: id, ownerId: user.id });
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

      // Restore folder and all its descendants recursively
      const descendants: string[] = [id];
      const allFolders = await Folder.find({ ownerId: user.id });
      
      const findDescendants = (parentId: string) => {
        const children = allFolders.filter(f => f.parentId?.toString() === parentId);
        for (const child of children) {
          descendants.push(String(child._id));
          findDescendants(String(child._id));
        }
      };
      
      findDescendants(id);

      await Folder.updateMany(
        { _id: { $in: descendants } },
        { $set: { isTrash: false, deletedAt: null } }
      );

      await FileModel.updateMany(
        { ownerId: user.id, parentFolderId: { $in: descendants } },
        { $set: { isTrash: false, deletedAt: null } }
      );
      
      // Recursive ancestor safety restoration
      if (folder.parentId) {
        await restoreParentFolders(user.id, folder.parentId.toString());
      }
      
      const ActivityLog = (await import("@/models/ActivityLog")).default;
      await ActivityLog.create({
        userId: user.id,
        action: "RESTORE",
        details: `Restored folder from trash: ${folder.name}`
      });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Trigger storage recalculation
    const { StorageService } = await import("@/services/StorageService");
    await StorageService.getStorageUsage(user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to restore asset" }, { status: 500 });
  }
}
