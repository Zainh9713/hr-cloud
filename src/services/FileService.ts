import connectDB from "@/lib/db";
import FileModel, { IFile } from "@/models/File";
import { StorageFactory } from "@/lib/storage/StorageFactory";
import { StorageService } from "./StorageService";
import crypto from "crypto";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Readable } from "stream";
import { runInTransaction } from "@/lib/transactions";
import { logger } from "@/lib/logger";
import { WebSocketService } from "@/lib/socket";

export class FileService {
  public static async getFiles(
    userId: string,
    folderId: string | null = null,
    page?: number,
    limit?: number
  ): Promise<{ files: IFile[]; totalCount: number }> {
    await connectDB();
    const cleanFolderId = folderId && folderId !== "null" ? folderId : null;

    let query: any;
    if (cleanFolderId) {
      const FolderModel = (await import("@/models/Folder")).default;
      const folder = await FolderModel.findById(cleanFolderId);
      if (folder && folder.ownerId.toString() !== userId) {
        const User = (await import("@/models/User")).default;
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");
        
        const { ShareService } = await import("./ShareService");
        const sharedAccess = await ShareService.isFolderSharedWithUser(cleanFolderId, user.email);
        if (!sharedAccess.isShared) {
          throw new Error("Access Denied: This folder is not shared with you.");
        }

        // List files of the folder owner inside this folder
        query = {
          ownerId: folder.ownerId,
          parentFolderId: cleanFolderId,
          isTrash: { $ne: true }
        };
      } else {
        query = {
          ownerId: userId,
          parentFolderId: cleanFolderId,
          isTrash: { $ne: true }
        };
      }
    } else {
      query = {
        ownerId: userId,
        parentFolderId: null,
        isTrash: { $ne: true }
      };
    }

    const totalCount = await FileModel.countDocuments(query);
    let dbQuery = FileModel.find(query).sort({ createdAt: -1 });

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      dbQuery = dbQuery.skip(skip).limit(limit);
    }

    const files = await dbQuery;
    return { files, totalCount };
  }

  public static async getFile(userId: string, fileId: string): Promise<IFile> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }
    return file;
  }

  public static async uploadFile(
    userId: string,
    originalName: string,
    fileData: Buffer | Readable,
    mimeType: string,
    parentFolderId: string | null = null,
    knownSize?: number,
    knownHash?: string
  ): Promise<IFile> {
    await connectDB();
    const cleanParentFolderId = parentFolderId && parentFolderId !== "null" ? parentFolderId : null;

    const size = Buffer.isBuffer(fileData) ? fileData.length : knownSize;
    if (size === undefined) {
      throw new Error("File size must be provided for stream uploads");
    }

    // Check space quota
    const hasSpace = await StorageService.hasSpaceFor(userId, size);
    if (!hasSpace) {
      throw new Error("Storage limit exceeded. Please upgrade your storage quota.");
    }

    // Compute checksum hash
    let hash = "";
    if (Buffer.isBuffer(fileData)) {
      hash = crypto.createHash("md5").update(fileData).digest("hex");
    } else if (knownHash) {
      hash = knownHash;
    } else {
      throw new Error("MD5 hash must be provided for stream uploads");
    }

    const extension = path.extname(originalName);
    const storedName = `${uuidv4()}${extension}`;

    const storageProvider = StorageFactory.getProvider();

    const uploadedFile = await runInTransaction(async ({ session, registerRollback }) => {
      // Check duplicate active files
      const existingFile = await FileModel.findOne({
        ownerId: userId,
        parentFolderId: cleanParentFolderId,
        originalName,
        isTrash: false
      }).session(session);

      if (existingFile) {
        // Fetch user email to track uploader details
        const User = (await import("@/models/User")).default;
        const user = await User.findById(userId).session(session);
        const userEmail = user ? user.email : "unknown";

        const archiveVersion = {
          version: (existingFile.versionHistory?.length || 0) + 1,
          storedName: existingFile.storedName,
          originalName: existingFile.originalName,
          path: existingFile.path,
          size: existingFile.size,
          hash: existingFile.hash,
          mimeType: existingFile.mimeType,
          aiSummary: existingFile.aiSummary,
          uploadedBy: userEmail,
          createdAt: existingFile.updatedAt || new Date()
        };

        // Perform upload
        const uploadResult = await storageProvider.uploadFile(userId, storedName, fileData);

        // Register deletion rollback for the newly uploaded file if database save fails
        registerRollback(async () => {
          logger.info(`Rolling back physical upload file from storage: ${uploadResult.path}`);
          await storageProvider.deleteFile(uploadResult.path);
        });

        existingFile.storedName = storedName;
        existingFile.path = uploadResult.path;
        existingFile.size = size;
        existingFile.mimeType = mimeType || "application/octet-stream";
        existingFile.hash = hash;
        existingFile.extension = extension;

        if (!existingFile.versionHistory) {
          existingFile.versionHistory = [];
        }
        existingFile.versionHistory.push(archiveVersion);

        await existingFile.save({ session });

        const ActivityLog = (await import("@/models/ActivityLog")).default;
        await ActivityLog.create([{
          userId,
          action: "UPLOAD_VERSION",
          details: `Uploaded new version of file: ${originalName} (V${archiveVersion.version})`
        }], { session });

        return existingFile;
      } else {
        // Normal upload
        const uploadResult = await storageProvider.uploadFile(userId, storedName, fileData);

        // Register deletion rollback for the newly uploaded file if database save fails
        registerRollback(async () => {
          logger.info(`Rolling back physical upload file from storage: ${uploadResult.path}`);
          await storageProvider.deleteFile(uploadResult.path);
        });

        const newFiles = await FileModel.create([{
          storedName,
          originalName,
          size,
          mimeType: mimeType || "application/octet-stream",
          extension,
          hash,
          path: uploadResult.path,
          parentFolderId: cleanParentFolderId,
          ownerId: userId,
          storageProvider: process.env.STORAGE_PROVIDER || "local",
          versionHistory: []
        }], { session });

        const newFile = newFiles[0];

        const ActivityLog = (await import("@/models/ActivityLog")).default;
        await ActivityLog.create([{
          userId,
          action: "UPLOAD",
          details: `Uploaded file: ${originalName}`
        }], { session });

        return newFile;
      }
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "upload", fileId: uploadedFile._id });
    } catch (wsErr) {
      logger.error("Failed to publish file upload event:", wsErr);
    }

    return uploadedFile;
  }

  public static async downloadFileStream(
    userId: string,
    fileId: string,
    version?: number,
    options?: { start?: number; end?: number }
  ): Promise<{ stream: Readable; originalName: string; mimeType: string; totalSize: number }> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    let filePath = file.path;
    let totalSize = file.size;
    if (version !== undefined) {
      const match = file.versionHistory.find((v: any) => v.version === version);
      if (!match) {
        throw new Error(`Version ${version} of file not found`);
      }
      filePath = match.path;
      totalSize = match.size;
    }

    const storageProvider = StorageFactory.getProvider();
    const stream = await storageProvider.downloadFileStream(filePath, options);

    return {
      stream,
      originalName: file.originalName,
      mimeType: file.mimeType,
      totalSize
    };
  }

  public static async deleteFile(userId: string, fileId: string): Promise<void> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    file.isTrash = true;
    file.deletedAt = new Date();
    await file.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "TRASH_FILE",
      details: `Moved file to trash: ${file.originalName}`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "trash", fileId });
    } catch (wsErr) {
      logger.error("Failed to publish file trash event:", wsErr);
    }
  }

  public static async moveFile(userId: string, fileId: string, targetFolderId: string | null): Promise<IFile> {
    await connectDB();
    const cleanFolderId = targetFolderId && targetFolderId !== "null" ? targetFolderId : null;

    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    // Check duplicate naming in destination folder
    const existing = await FileModel.findOne({
      ownerId: userId,
      parentFolderId: cleanFolderId,
      originalName: file.originalName,
      isTrash: false,
      _id: { $ne: fileId }
    });

    if (existing) {
      throw new Error(`A file named "${file.originalName}" already exists in the target directory.`);
    }

    file.parentFolderId = cleanFolderId as any;
    await file.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "MOVE_FILE",
      details: `Moved file "${file.originalName}" to another directory`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "move", fileId });
    } catch (wsErr) {
      logger.error("Failed to publish file move event:", wsErr);
    }

    return file;
  }

  public static async updateFile(
    userId: string,
    fileId: string,
    updates: Partial<Pick<IFile, "originalName" | "isStarred" | "isTrash" | "tags">>
  ): Promise<IFile> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    // Clean up undefined properties to prevent Mongoose schema pollution
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    ) as Partial<Pick<IFile, "originalName" | "isStarred" | "isTrash" | "tags" | "deletedAt">>;

    if (cleanUpdates.originalName && cleanUpdates.originalName !== file.originalName) {
      // Validate unique name in directory
      const existing = await FileModel.findOne({
        ownerId: userId,
        parentFolderId: file.parentFolderId,
        originalName: cleanUpdates.originalName,
        isTrash: false,
        _id: { $ne: fileId }
      });
      if (existing) {
        throw new Error(`A file named "${cleanUpdates.originalName}" already exists in this directory.`);
      }
    }

    Object.assign(file, cleanUpdates);
    if (cleanUpdates.isTrash) {
      file.deletedAt = new Date();
    } else if (cleanUpdates.isTrash === false) {
      file.deletedAt = null;
    }

    await file.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: updates.isTrash ? "TRASH_FILE" : "UPDATE_FILE",
      details: updates.isTrash ? `Moved file "${file.originalName}" to trash` : `Updated file metadata: ${file.originalName}`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: updates.isTrash ? "trash" : "update", fileId });
    } catch (wsErr) {
      logger.error("Failed to publish file update event:", wsErr);
    }

    return file;
  }

  public static async restoreVersion(userId: string, fileId: string, versionNumber: number): Promise<any> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    const versionIndex = file.versionHistory.findIndex((v: any) => v.version === versionNumber);
    if (versionIndex === -1) {
      throw new Error(`Version ${versionNumber} not found in this file's logs.`);
    }

    const targetVersion = file.versionHistory[versionIndex];

    const User = (await import("@/models/User")).default;
    const user = await User.findById(userId);
    const userEmail = user ? user.email : "unknown";

    // Build the backup version node of the current active file configuration
    const activeAsVersion = {
      version: (file.versionHistory.length || 0) + 1,
      storedName: file.storedName,
      originalName: file.originalName,
      path: file.path,
      size: file.size,
      hash: file.hash,
      mimeType: file.mimeType,
      aiSummary: file.aiSummary,
      uploadedBy: userEmail,
      createdAt: file.updatedAt || new Date()
    };

    // Promote the target version metadata to active file configuration
    file.storedName = targetVersion.storedName;
    file.originalName = targetVersion.originalName;
    file.path = targetVersion.path;
    file.size = targetVersion.size;
    file.hash = targetVersion.hash;
    file.mimeType = targetVersion.mimeType;
    file.aiSummary = targetVersion.aiSummary;

    // Remove restored version, and push old active configuration to history
    file.versionHistory.splice(versionIndex, 1);
    file.versionHistory.push(activeAsVersion);

    await file.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "RESTORE_VERSION",
      details: `Restored file "${file.originalName}" to version V${versionNumber}`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "restore_version", fileId });
    } catch (wsErr) {
      logger.error("Failed to publish restore version event:", wsErr);
    }

    return file;
  }

  public static async deleteVersion(userId: string, fileId: string, versionNumber: number): Promise<any> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    const versionIndex = file.versionHistory.findIndex((v: any) => v.version === versionNumber);
    if (versionIndex === -1) {
      throw new Error(`Version ${versionNumber} not found.`);
    }

    const targetVersion = file.versionHistory[versionIndex];

    // Remove the version from database log list first (database consistency)
    file.versionHistory.splice(versionIndex, 1);
    await file.save();

    // Now delete physical resource from active storage (rollback/state safety)
    const storageProvider = StorageFactory.getProvider();
    await storageProvider.deleteFile(targetVersion.path);

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "DELETE_VERSION",
      details: `Purged version V${versionNumber} of file "${file.originalName}"`
    });

    try {
      WebSocketService.publish(userId, "file_system_change", { action: "delete_version", fileId });
    } catch (wsErr) {
      logger.error("Failed to publish delete version event:", wsErr);
    }

    return file;
  }
}
