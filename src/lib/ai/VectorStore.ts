import connectDB from "../db";
import FileModel from "@/models/File";
import AICache from "@/models/AICache";
import { logger } from "../logger";

export interface IVectorStore {
  /**
   * Saves a vector embedding for a specific content hash.
   */
  saveEmbedding(hash: string, embedding: number[]): Promise<void>;

  /**
   * Computes cosine similarity of query embedding against files owned by a user.
   */
  searchSimilar(
    ownerId: string,
    queryEmbedding: number[],
    limit?: number
  ): Promise<{ fileId: string; score: number }[]>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

export class LocalVectorStore implements IVectorStore {
  public async saveEmbedding(hash: string, embedding: number[]): Promise<void> {
    await connectDB();
    await AICache.updateOne(
      { hash },
      { $set: { embedding } },
      { upsert: true }
    );
  }

  public async searchSimilar(
    ownerId: string,
    queryEmbedding: number[],
    limit = 10
  ): Promise<{ fileId: string; score: number }[]> {
    await connectDB();

    // 1. Get all active files for this user
    const files = await FileModel.find({
      ownerId,
      isTrash: { $ne: true }
    }).select("_id hash");

    if (files.length === 0) {
      return [];
    }

    const fileHashes = files.map(f => f.hash).filter(Boolean);
    
    // 2. Fetch embeddings from AICache for these hashes
    const caches = await AICache.find({
      hash: { $in: fileHashes },
      embedding: { $exists: true, $not: { $size: 0 } }
    }).select("hash embedding");

    // Map hash -> embedding
    const embeddingMap = new Map<string, number[]>();
    for (const c of caches) {
      embeddingMap.set(c.hash, c.embedding);
    }

    // 3. Compute cosine similarity
    const scoredFiles: { fileId: string; score: number }[] = [];
    for (const file of files) {
      const emb = embeddingMap.get(file.hash);
      if (emb) {
        const score = cosineSimilarity(queryEmbedding, emb);
        scoredFiles.push({
          fileId: String(file._id),
          score
        });
      }
    }

    // 4. Sort and limit
    return scoredFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export class VectorStoreFactory {
  private static instance: IVectorStore | null = null;

  public static getStore(): IVectorStore {
    if (!this.instance) {
      this.instance = new LocalVectorStore();
    }
    return this.instance;
  }
}
