import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import Folder from "@/models/Folder";
import { StorageFactory } from "@/lib/storage/StorageFactory";

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

    // 30-Day Auto Purge Logic
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find expired files
    const expiredFiles = await FileModel.find({ 
      ownerId: user.id, 
      isTrash: true, 
      deletedAt: { $lte: thirtyDaysAgo } 
    });

    const storageProvider = StorageFactory.getProvider();

    for (const file of expiredFiles) {
      try {
        await storageProvider.deleteFile(file.path);
        if (file.versionHistory && file.versionHistory.length > 0) {
          for (const ver of file.versionHistory) {
            await storageProvider.deleteFile(ver.path);
          }
        }
      } catch (e) {
        console.error(`Failed to delete storage path for expired file: ${file.originalName}`, e);
      }
    }

    if (expiredFiles.length > 0) {
      await FileModel.deleteMany({ _id: { $in: expiredFiles.map(f => f._id) } });
    }

    // Delete expired folders (no physical files associated directly with folders)
    await Folder.deleteMany({ 
      ownerId: user.id, 
      isTrash: true, 
      deletedAt: { $lte: thirtyDaysAgo } 
    });

    // Fetch remaining trash
    const files = await FileModel.find({ ownerId: user.id, isTrash: true }).sort({ deletedAt: -1 });
    const folders = await Folder.find({ ownerId: user.id, isTrash: true }).sort({ deletedAt: -1 });

    return NextResponse.json({ files, folders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to query trash databank" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type"); // "file" or "folder"

    if (!id || !type) return NextResponse.json({ error: "ID and type required" }, { status: 400 });

    await connectDB();
    const storageProvider = StorageFactory.getProvider();

    if (type === "file") {
      const file = await FileModel.findOne({ _id: id, ownerId: user.id, isTrash: true });
      if (!file) return NextResponse.json({ error: "File not found in trash" }, { status: 404 });

      try {
        await storageProvider.deleteFile(file.path);
        if (file.versionHistory && file.versionHistory.length > 0) {
          for (const ver of file.versionHistory) {
            await storageProvider.deleteFile(ver.path);
          }
        }
      } catch (err: any) {
        console.error("Failed to delete physical file", err);
      }

      await FileModel.deleteOne({ _id: id });
    } else if (type === "folder") {
      // Find the folder
      const folder = await Folder.findOne({ _id: id, ownerId: user.id, isTrash: true });
      if (!folder) return NextResponse.json({ error: "Folder not found in trash" }, { status: 404 });

      const allFolders = await Folder.find({ ownerId: user.id });
      const descendants: string[] = [];
      const findDescendants = (parentId: string) => {
        const children = allFolders.filter(f => f.parentId?.toString() === parentId);
        for (const child of children) {
          descendants.push(child._id.toString());
          findDescendants(child._id.toString());
        }
      };
      
      descendants.push(id);
      findDescendants(id);

      const filesToDelete = await FileModel.find({ ownerId: user.id, parentFolderId: { $in: descendants } });
      for (const file of filesToDelete) {
        try {
          await storageProvider.deleteFile(file.path);
          if (file.versionHistory && file.versionHistory.length > 0) {
            for (const ver of file.versionHistory) {
              await storageProvider.deleteFile(ver.path);
            }
          }
        } catch (err) {
          console.error("Failed to delete recursive file from storage provider", err);
        }
      }

      await FileModel.deleteMany({ ownerId: user.id, parentFolderId: { $in: descendants } });
      await Folder.deleteMany({ _id: { $in: descendants } });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Trigger storage recalculation
    const { StorageService } = await import("@/services/StorageService");
    await StorageService.getStorageUsage(user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to purge asset permanently" }, { status: 500 });
  }
}
