import mongoose, { Schema, Document } from "mongoose";

export interface IStorageStats extends Document {
  userId: mongoose.Types.ObjectId;
  totalLimit: number;
  usedStorage: number;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StorageStatsSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalLimit: { type: Number, required: true, default: 5 * 1024 * 1024 * 1024 }, // 5GB default
    usedStorage: { type: Number, required: true, default: 0 },
    lastCalculated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const StorageStats = mongoose.models.StorageStats || mongoose.model<IStorageStats>("StorageStats", StorageStatsSchema);
export default StorageStats;


