import mongoose, { Schema, Document } from "mongoose";

export interface IShareAccessLog extends Document {
  shareLinkId: mongoose.Types.ObjectId;
  action: "view" | "download";
  ip: string | null;
  userAgent: string | null;
  accessedAt: Date;
}

const ShareAccessLogSchema = new Schema(
  {
    shareLinkId: { type: Schema.Types.ObjectId, ref: "SharedLink", required: true, index: true },
    action: { type: String, enum: ["view", "download"], required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  { timestamps: { createdAt: "accessedAt", updatedAt: false } }
);

const ShareAccessLog = mongoose.models.ShareAccessLog || mongoose.model<IShareAccessLog>("ShareAccessLog", ShareAccessLogSchema);
export default ShareAccessLog;


