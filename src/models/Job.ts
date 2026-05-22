import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  payload: Record<string, any>;
  result: Record<string, any> | null;
  error: string | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["pending", "running", "completed", "failed"], 
      default: "pending" 
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 }
  },
  { timestamps: true }
);

JobSchema.index({ userId: 1, status: 1 });
JobSchema.index({ createdAt: 1 });

const Job = mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);
export default Job;


