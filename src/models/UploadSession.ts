import mongoose, { Schema, Document } from "mongoose";

export interface IUploadSession extends Document {
  uploadId: string;
  userId: mongoose.Types.ObjectId;
  originalName: string;
  fileSize: number;
  mimeType: string;
  parentFolderId: mongoose.Types.ObjectId | null;
  totalChunks: number;
  uploadedChunks: number[];
  hash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UploadSessionSchema = new Schema(
  {
    uploadId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    parentFolderId: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    totalChunks: { type: Number, required: true },
    uploadedChunks: { type: [Number], default: [] },
    hash: { type: String, default: null }
  },
  { timestamps: true }
);

UploadSessionSchema.index({ uploadId: 1 });
UploadSessionSchema.index({ userId: 1, createdAt: -1 });

const UploadSession = mongoose.models.UploadSession || mongoose.model<IUploadSession>("UploadSession", UploadSessionSchema);
export default UploadSession;


