import mongoose, { Schema, Document } from "mongoose";

export interface ISavedSearch extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  filters: {
    mimeType?: string;
    sizeMin?: number;
    sizeMax?: number;
    dateMin?: string;
    dateMax?: string;
    tags?: string[];
    isStarred?: boolean;
    queryText?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SavedSearchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    filters: {
      mimeType: { type: String, default: null },
      sizeMin: { type: Number, default: null },
      sizeMax: { type: Number, default: null },
      dateMin: { type: String, default: null },
      dateMax: { type: String, default: null },
      tags: { type: [String], default: [] },
      isStarred: { type: Boolean, default: null },
      queryText: { type: String, default: null }
    }
  },
  { timestamps: true }
);

const SavedSearch = mongoose.models.SavedSearch || mongoose.model<ISavedSearch>("SavedSearch", SavedSearchSchema);
export default SavedSearch;


