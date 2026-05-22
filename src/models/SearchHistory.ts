import mongoose, { Schema, Document } from "mongoose";

export interface ISearchHistory extends Document {
  userId: mongoose.Types.ObjectId;
  query: string;
  createdAt: Date;
}

const SearchHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    query: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const SearchHistory = mongoose.models.SearchHistory || mongoose.model<ISearchHistory>("SearchHistory", SearchHistorySchema);
export default SearchHistory;


