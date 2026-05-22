import mongoose, { Schema, Document } from "mongoose";

export interface IAICache extends Document {
  hash: string;            // MD5 checksum of the file
  parsedText: string | null; // Extracted plain text (from PDF, TXT, etc.)
  ocrResult: string | null;  // OCR text extracted from images
  summary: string | null;    // Summarized document cache
  category: string | null;   // Classified AI Category
  tags: string[];            // AI tags generated
  embedding: number[];      // Cached semantic embedding vector
  createdAt: Date;
  updatedAt: Date;
}

const AICacheSchema = new Schema(
  {
    hash: { type: String, required: true, unique: true, index: true },
    parsedText: { type: String, default: null },
    ocrResult: { type: String, default: null },
    summary: { type: String, default: null },
    category: { type: String, default: null },
    tags: { type: [String], default: [] },
    embedding: { type: [Number], default: [] }
  },
  { timestamps: true }
);

const AICache = mongoose.models.AICache || mongoose.model<IAICache>("AICache", AICacheSchema);
export default AICache;


