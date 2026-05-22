import connectDB from "@/lib/db";
import Folder, { IFolder } from "@/models/Folder";
import FileModel from "@/models/File";
import { backgroundJobQueue } from "./BackgroundJobService";
import { WebSocketService } from "@/lib/socket";

export class FolderService {
  public static async getFolders(
    userId: string,
    parentId: string | null = null,
    page?: number,
    limit?: number
  ): Promise<{ folders: IFolder[]; totalCount: number }> {
    await connectDB();
    const cleanParentId = parentId === "null" ? null : parentId;

    let query: any;
    if (cleanParentId) {
      const folder = await Folder.findById(cleanParentId);
      if (folder && folder.ownerId.toString() !== userId) {
        const User = (await import("@/models/User")).default;
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        const { ShareService } = await import("./ShareService");
        const sharedAccess = await ShareService.isFolderSharedWithUser(cleanParentId, user.email);
        if (!sharedAccess.isShared) {
          throw new Error("Access Denied: This directory is not shared with you.");
        }

        // Return subfolders owned by the parent folder's owner
        query = {
          ownerId: folder.ownerId,
          parentId: cleanParentId,
          isTrash: { $ne: true }
        };
      } else {
        query = {
          ownerId: userId,
          parentId: cleanParentId,
          isTrash: { $ne: true }
        };
      }
    } else {
      query = {
        ownerId: userId,
        parentId: null,
        isTrash: { $ne: true }
      };
    }

    const totalCount = await Folder.countDocuments(query);
    let dbQuery = Folder.find(query).sort({ name: 1 });

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      dbQuery = dbQuery.skip(skip).limit(limit);
    }

    const folders = await dbQuery;
    return { folders, totalCount };
  }

  public static async getAllFoldersForUser(userId: string): Promise<IFolder[]> {
    await connectDB();
    return Folder.find({
      ownerId: userId,
      isTrash: { $ne: true }
    }).sort({ name: 1 });
  }

  public static async createFolder(
    userId: string,
    name: string,
    parentId: string | null = null,
    color?: string,
    icon?: string
  ): Promise<IFolder> {
    await connectDB();
    const cleanParentId = parentId && parentId !== "null" ? parentId : null;

    // Duplicate check
    const existing = await Folder.findOne({
      ownerId: userId,
      parentId: cleanParentId,
      name,
      isTrash: false
    });

    if (existing) {
      throw new Error(`A folder named "${name}" already exists in this directory.`);
    }

    const folder = await Folder.create({
      name,
      parentId: cleanParentId,
      ownerId: userId,
      color: color || "#0ea5e9",
      icon: icon || "folder"
    });

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "CREATE_FOLDER",
      details: `Created folder: ${name}`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "create_folder", folderId: folder._id });
    } catch (wsErr) {
      console.error("Failed to publish folder create event:", wsErr);
    }

    return folder;
  }

  public static async updateFolder(
    userId: string,
    folderId: string,
    updates: Partial<Pick<IFolder, "name" | "color" | "icon" | "isStarred" | "isTrash">>
  ): Promise<IFolder> {
    await connectDB();
    const folder = await Folder.findOne({ _id: folderId, ownerId: userId });
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Clean up undefined properties to prevent Mongoose schema pollution
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    ) as Partial<Pick<IFolder, "name" | "color" | "icon" | "isStarred" | "isTrash" | "deletedAt">>;

    if (cleanUpdates.name && cleanUpdates.name !== folder.name) {
      // Validate name uniqueness in the folder's parent directory
      const existing = await Folder.findOne({
        ownerId: userId,
        parentId: folder.parentId,
        name: cleanUpdates.name,
        isTrash: false,
        _id: { $ne: folderId }
      });
      if (existing) {
        throw new Error(`A folder named "${cleanUpdates.name}" already exists in this directory.`);
      }
    }

    Object.assign(folder, cleanUpdates);
    if (cleanUpdates.isTrash) {
      folder.deletedAt = new Date();
    } else if (cleanUpdates.isTrash === false) {
      folder.deletedAt = null;
    }

    await folder.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: updates.isTrash ? "TRASH_FOLDER" : "UPDATE_FOLDER",
      details: updates.isTrash ? `Moved folder "${folder.name}" to trash` : `Updated folder: ${folder.name}`
    });

    // If trashed, soft-delete descendants asynchronously in background
    if (updates.isTrash) {
      await backgroundJobQueue.enqueue(userId, "RECURSIVE_DELETE", {
        userId,
        folderId,
        deletedAt: folder.deletedAt
      });
    }

    try {
      WebSocketService.publish(userId, "file_system_change", { action: updates.isTrash ? "trash_folder" : "update_folder", folderId });
    } catch (wsErr) {
      console.error("Failed to publish folder update event:", wsErr);
    }

    return folder;
  }

  public static async moveFolder(userId: string, folderId: string, targetParentId: string | null): Promise<IFolder> {
    await connectDB();
    const cleanParentId = targetParentId && targetParentId !== "null" ? targetParentId : null;

    if (folderId === cleanParentId) {
      throw new Error("Cannot move a folder into itself.");
    }

    const folder = await Folder.findOne({ _id: folderId, ownerId: userId });
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Cycle protection check
    if (cleanParentId) {
      const isDesc = await this.isDescendant(folderId, cleanParentId);
      if (isDesc) {
        throw new Error("Cannot move a folder into one of its subfolders.");
      }
    }

    // Uniqueness validation in target directory
    const existing = await Folder.findOne({
      ownerId: userId,
      parentId: cleanParentId,
      name: folder.name,
      isTrash: false,
      _id: { $ne: folderId }
    });
    if (existing) {
      throw new Error(`A folder named "${folder.name}" already exists in the target directory.`);
    }

    folder.parentId = cleanParentId as any;
    await folder.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "MOVE_FOLDER",
      details: `Moved folder "${folder.name}" to another directory`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "move_folder", folderId });
    } catch (wsErr) {
      console.error("Failed to publish folder move event:", wsErr);
    }

    return folder;
  }

  private static async isDescendant(checkFolderId: string, parentFolderId: string): Promise<boolean> {
    let currentParentId: string | null = parentFolderId;
    while (currentParentId) {
      if (currentParentId.toString() === checkFolderId.toString()) {
        return true;
      }
      const parentFolder = (await Folder.findById(currentParentId)) as IFolder | null;
      if (!parentFolder) break;
      currentParentId = parentFolder.parentId ? parentFolder.parentId.toString() : null;
    }
    return false;
  }

  public static async deleteFolderRecursively(userId: string, folderId: string, deletedAt: Date): Promise<void> {
    await connectDB();
    
    const descendants: string[] = [folderId];
    const queue: string[] = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      // Find direct subfolders using projection to minimize memory
      const children = await Folder.find({ ownerId: userId, parentId: currentId }).select("_id");
      for (const child of children) {
        const childId = child._id.toString();
        descendants.push(childId);
        queue.push(childId);
      }
    }

    // Soft delete files in all these folders
    await FileModel.updateMany(
      { ownerId: userId, parentFolderId: { $in: descendants } },
      { $set: { isTrash: true, deletedAt } }
    );

    // Soft delete all descendant folders
    await Folder.updateMany(
      { _id: { $in: descendants }, ownerId: userId },
      { $set: { isTrash: true, deletedAt } }
    );

    // Publish WebSocket sync update event
    try {
      WebSocketService.publish(userId, "file_system_change", { action: "delete_folder_recursive", folderId });
    } catch (wsErr) {
      console.error("Failed to publish folder recursive deletion event:", wsErr);
    }
  }
}
