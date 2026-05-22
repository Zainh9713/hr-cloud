import connectDB from "@/lib/db";
import SharedLinkModel, { ISharedLink } from "@/models/SharedLink";
import ShareAccessLogModel from "@/models/ShareAccessLog";
import FileModel from "@/models/File";
import FolderModel from "@/models/Folder";
import UserModel from "@/models/User";
import crypto from "crypto";
import { logger } from "@/lib/logger";

export class ShareService {
  private static hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  public static async createShare(
    ownerId: string,
    targetId: string,
    targetType: "file" | "folder",
    options: {
      shareType?: "public" | "private";
      sharedWithEmail?: string | null;
      role?: "viewer" | "editor";
      password?: string | null;
      expiresAt?: Date | null;
    }
  ): Promise<ISharedLink> {
    await connectDB();

    // Verify ownership
    if (targetType === "file") {
      const file = await FileModel.findOne({ _id: targetId, ownerId });
      if (!file) throw new Error("File not found or access denied");
    } else {
      const folder = await FolderModel.findOne({ _id: targetId, ownerId });
      if (!folder) throw new Error("Folder not found or access denied");
    }

    const token = crypto.randomBytes(24).toString("hex");
    const passwordHash = options.password ? this.hashPassword(options.password) : null;

    const share = await SharedLinkModel.create({
      fileId: targetType === "file" ? targetId : null,
      folderId: targetType === "folder" ? targetId : null,
      ownerId,
      token,
      shareType: options.shareType || "public",
      sharedWithEmail: options.sharedWithEmail || null,
      role: options.role || "viewer",
      passwordHash,
      expiresAt: options.expiresAt || null,
      isRevoked: false
    });

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId: ownerId,
      action: "SHARE_CREATE",
      details: `Created a ${options.shareType || "public"} share link for ${targetType}: ${targetId}`
    });

    return share;
  }

  public static async revokeShare(ownerId: string, shareId: string): Promise<void> {
    await connectDB();
    const share = await SharedLinkModel.findOne({ _id: shareId, ownerId });
    if (!share) throw new Error("Share link not found or access denied");

    share.isRevoked = true;
    await share.save();

    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId: ownerId,
      action: "SHARE_REVOKE",
      details: `Revoked share link with token: ${share.token}`
    });
  }

  public static async validateShareAccess(
    token: string,
    context: { password?: string; email?: string }
  ): Promise<ISharedLink> {
    await connectDB();
    const share = await SharedLinkModel.findOne({ token, isRevoked: false });
    if (!share) {
      throw new Error("Share link is invalid or has been revoked");
    }

    // Check expiration
    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new Error("Share link has expired");
    }

    // Check private email sharing
    if (share.shareType === "private") {
      if (!context.email) {
        throw new Error("This share link is private. Access authentication email required.");
      }
      if (share.sharedWithEmail?.toLowerCase() !== context.email.toLowerCase()) {
        throw new Error("Access denied: This link was shared with a different user.");
      }
    }

    // Check password protection
    if (share.passwordHash) {
      if (!context.password) {
        throw new Error("Password required to access this share");
      }
      const testHash = this.hashPassword(context.password);
      if (share.passwordHash !== testHash) {
        throw new Error("Incorrect password provided");
      }
    }

    return share;
  }

  public static async logAccess(
    shareLinkId: string,
    action: "view" | "download",
    ip: string | null,
    userAgent: string | null
  ): Promise<void> {
    await connectDB();
    const updateField = action === "view" ? { $inc: { viewsCount: 1 } } : { $inc: { downloadsCount: 1 } };
    await SharedLinkModel.findByIdAndUpdate(shareLinkId, updateField);
    await ShareAccessLogModel.create({
      shareLinkId,
      action,
      ip,
      userAgent
    });
  }

  /**
   * Recursively checks if a folder is a subfolder of any folder shared with the user's email.
   */
  public static async isFolderSharedWithUser(
    folderId: string | null,
    userEmail: string
  ): Promise<{ isShared: boolean; role: "viewer" | "editor" }> {
    if (!folderId) return { isShared: false, role: "viewer" };
    await connectDB();

    let currentFolderId: string | null = folderId;

    while (currentFolderId) {
      // Check if folder is directly shared with the email
      const activeShare = await SharedLinkModel.findOne({
        folderId: currentFolderId,
        isRevoked: false,
        $or: [
          { shareType: "public" },
          { shareType: "private", sharedWithEmail: userEmail.toLowerCase() }
        ]
      });

      if (activeShare && (!activeShare.expiresAt || new Date() < activeShare.expiresAt)) {
        return { isShared: true, role: activeShare.role };
      }

      // Fetch parent folder to traverse up
      const parentFolder: any = await FolderModel.findById(currentFolderId);
      if (!parentFolder || !parentFolder.parentFolderId) {
        break;
      }
      currentFolderId = parentFolder.parentFolderId.toString();
    }

    return { isShared: false, role: "viewer" };
  }

  /**
   * Checks if a file is shared with user's email directly or via a shared parent directory.
   */
  public static async isFileSharedWithUser(
    fileId: string,
    userEmail: string
  ): Promise<{ isShared: boolean; role: "viewer" | "editor" }> {
    await connectDB();
    
    // Check direct file share
    const directShare = await SharedLinkModel.findOne({
      fileId,
      isRevoked: false,
      $or: [
        { shareType: "public" },
        { shareType: "private", sharedWithEmail: userEmail.toLowerCase() }
      ]
    });

    if (directShare && (!directShare.expiresAt || new Date() < directShare.expiresAt)) {
      return { isShared: true, role: directShare.role };
    }

    // Check parent folder share
    const file = await FileModel.findById(fileId);
    if (file && file.parentFolderId) {
      return this.isFolderSharedWithUser(file.parentFolderId.toString(), userEmail);
    }

    return { isShared: false, role: "viewer" };
  }

  /**
   * Retrieves all shared links directly shared with a user email.
   */
  public static async getSharedWithUser(userEmail: string): Promise<any[]> {
    await connectDB();
    const links = await SharedLinkModel.find({
      sharedWithEmail: userEmail.toLowerCase(),
      isRevoked: false
    })
      .populate("fileId")
      .populate("folderId")
      .populate("ownerId", "username email");

    return links;
  }
}
