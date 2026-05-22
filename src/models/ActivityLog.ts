import mongoose, { Schema, Document } from "mongoose";

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: string;
  details: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    details: { type: String, required: true },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
export default ActivityLog;


