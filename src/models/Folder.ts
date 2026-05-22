import mongoose, { Schema, Document } from "mongoose";

export interface IFolder extends Document {
  name: string;
  parentId: mongoose.Types.ObjectId | null;
  ownerId: mongoose.Types.ObjectId;
  isTrash: boolean;
  deletedAt: Date | null;
  color: string;
  icon: string;
  isStarred: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isTrash: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    color: { type: String, default: "#0ea5e9" }, // default neon blue/cyan
    icon: { type: String, default: "folder" },
    isStarred: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for faster lookups
FolderSchema.index({ ownerId: 1, parentId: 1 });
FolderSchema.index({ isTrash: 1 });
FolderSchema.index({ ownerId: 1, isTrash: 1, createdAt: -1 });
FolderSchema.index({ ownerId: 1, isStarred: 1, isTrash: 1 }); // Starred folder indexing

// Partial unique index to enforce duplicate naming protection ONLY for active folders
FolderSchema.index(
  { ownerId: 1, parentId: 1, name: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isTrash: false } 
  }
);

const Folder = mongoose.models.Folder || mongoose.model<IFolder>("Folder", FolderSchema);
export default Folder;


