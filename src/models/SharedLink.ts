import mongoose, { Schema, Document } from "mongoose";

export interface ISharedLink extends Document {
  fileId: mongoose.Types.ObjectId | null;
  folderId: mongoose.Types.ObjectId | null;
  ownerId: mongoose.Types.ObjectId;
  token: string;
  shareType: "public" | "private";
  sharedWithEmail: string | null;
  role: "viewer" | "editor" | "owner";
  passwordHash: string | null;
  expiresAt: Date | null;
  isRevoked: boolean;
  viewsCount: number;
  downloadsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SharedLinkSchema: Schema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "File", default: null },
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    shareType: { type: String, enum: ["public", "private"], default: "public" },
    sharedWithEmail: { type: String, default: null },
    role: { type: String, enum: ["viewer", "editor", "owner"], default: "viewer" },
    passwordHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isRevoked: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0 },
    downloadsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Performance compound indexes
SharedLinkSchema.index({ ownerId: 1 });
SharedLinkSchema.index({ fileId: 1 });
SharedLinkSchema.index({ folderId: 1 });
SharedLinkSchema.index({ sharedWithEmail: 1 });
SharedLinkSchema.index({ token: 1 });

const SharedLink = mongoose.models.SharedLink || mongoose.model<ISharedLink>("SharedLink", SharedLinkSchema);
export default SharedLink;


