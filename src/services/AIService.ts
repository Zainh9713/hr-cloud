import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import AICache from "@/models/AICache";
import { FileService } from "./FileService";
import { AIProviderFactory } from "@/lib/ai/AIProviderFactory";
import { VectorStoreFactory } from "@/lib/ai/VectorStore";
import { logger } from "@/lib/logger";

export class AIService {
  public static async summarizeFile(userId: string, fileId: string): Promise<{ summary: string; category: string; tags: string[] }> {
    await connectDB();
    const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      throw new Error("File not found");
    }

    const hash = file.hash;
    const provider = AIProviderFactory.getProvider();

    // Check if result is already in AICache
    let cached = await AICache.findOne({ hash });

    if (cached && cached.summary) {
      logger.info(`AI Cache hit for hash: ${hash} (File: ${file.originalName})`);
      
      file.aiSummary = cached.summary;
      file.aiCategory = cached.category;
      file.tags = cached.tags;
      await file.save();

      return {
        summary: cached.summary,
        category: cached.category || "Other",
        tags: cached.tags
      };
    }

    logger.info(`AI Cache miss for hash: ${hash}. Starting analysis pipeline...`);

    // 1. Download the full file content into a Buffer for processing
    const { stream } = await FileService.downloadFileStream(userId, fileId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);

    // 2. Extract content snippet or OCR text
    let contentSnippet = "";
    let ocrResult: string | null = null;

    const textExtensions = [".txt", ".json", ".md", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".csv", ".xml"];
    const isText = file.mimeType.startsWith("text/") || textExtensions.includes(file.extension.toLowerCase());

    if (isText) {
      contentSnippet = fileBuffer.toString("utf-8").slice(0, 15000);
    } else if (file.mimeType.startsWith("image/")) {
      logger.info(`Image file detected. Running OCR for file: ${file.originalName}`);
      ocrResult = await provider.performOCR(file.mimeType, fileBuffer);
      contentSnippet = ocrResult ? ocrResult.slice(0, 15000) : "";
    }

    // 3. Generate summary, category, and tags
    const result = await provider.generateSummary(
      file.originalName,
      file.mimeType,
      fileBuffer,
      contentSnippet
    );

    // 4. Generate semantic embedding vector
    const embeddingText = `Name: ${file.originalName}\nCategory: ${result.category}\nSummary: ${result.summary}\nTags: ${result.tags.join(", ")}\nContent: ${contentSnippet.slice(0, 1000)}`;
    logger.info(`Generating semantic embedding vector for: ${file.originalName}`);
    let embedding: number[] = [];
    try {
      embedding = await provider.generateEmbedding(embeddingText);
    } catch (embErr) {
      logger.error("Failed to generate embedding vector during analysis", embErr);
    }

    // 5. Save results to AICache
    await AICache.updateOne(
      { hash },
      {
        $set: {
          parsedText: isText ? contentSnippet : null,
          ocrResult,
          summary: result.summary,
          category: result.category,
          tags: result.tags,
          embedding
        }
      },
      { upsert: true }
    );

    // 6. Update File metadata
    file.aiSummary = result.summary;
    file.aiCategory = result.category;
    file.tags = result.tags;
    await file.save();

    // 7. Log activity
    const ActivityLog = (await import("@/models/ActivityLog")).default;
    await ActivityLog.create({
      userId,
      action: "AI_ANALYSIS",
      details: `Completed AI analysis and indexed semantic embeddings for file: ${file.originalName}`
    });

    return result;
  }
}
