import mongoose, { Schema, Document } from "mongoose";

export interface IVersion {
  version: number;
  storedName: string;
  originalName: string;
  path: string;
  size: number;
  hash: string;
  mimeType: string;
  aiSummary: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export interface IFile extends Document {
  storedName: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string;
  hash: string;
  path: string;
  parentFolderId: mongoose.Types.ObjectId | null;
  ownerId: mongoose.Types.ObjectId;
  isTrash: boolean;
  deletedAt: Date | null;
  isStarred: boolean;
  isShared: boolean;
  thumbnailPath: string | null;
  previewPath: string | null;
  storageProvider: string;
  versionHistory: IVersion[];
  tags: string[];
  aiSummary: string | null;
  aiCategory: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const VersionSchema = new Schema({
  version: { type: Number, required: true },
  storedName: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  hash: { type: String, default: "" },
  mimeType: { type: String, required: true },
  aiSummary: { type: String, default: null },
  uploadedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const FileSchema: Schema = new Schema(
  {
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    extension: { type: String, default: "" },
    hash: { type: String, default: "" },
    path: { type: String, required: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isTrash: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isStarred: { type: Boolean, default: false },
    isShared: { type: Boolean, default: false },
    thumbnailPath: { type: String, default: null },
    previewPath: { type: String, default: null },
    storageProvider: { type: String, default: "local" },
    versionHistory: { type: [VersionSchema], default: [] },
    tags: { type: [String], default: [] },
    aiSummary: { type: String, default: null },
    aiCategory: { type: String, default: null }
  },
  { timestamps: true }
);

// Optimize database queries with proper indexes
FileSchema.index({ ownerId: 1, parentFolderId: 1 });
FileSchema.index({ ownerId: 1, isTrash: 1, createdAt: -1 });
FileSchema.index({ ownerId: 1, isTrash: 1, updatedAt: -1 }); // Recent files sorting
FileSchema.index({ ownerId: 1, isStarred: 1, isTrash: 1 }); // Starred files sorting
FileSchema.index({ isStarred: 1 });
FileSchema.index({ hash: 1 });
FileSchema.index({ tags: 1 });
FileSchema.index({ mimeType: 1 });

// Partial unique index for duplicate protection: prevents files with same name under same folder unless trashed
FileSchema.index(
  { ownerId: 1, parentFolderId: 1, originalName: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isTrash: false } 
  }
);

const File = mongoose.models.File || mongoose.model<IFile>("File", FileSchema);
export default File;


