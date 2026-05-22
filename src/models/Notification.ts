import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "upload_complete" | "ai_analysis" | "share_invite" | "storage_warning" | "upload_failed" | "ocr_complete" | "info";
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["upload_complete", "ai_analysis", "share_invite", "storage_warning", "upload_failed", "ocr_complete", "info"],
      default: "info"
    },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Optimize notification lookups
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
export default Notification;


