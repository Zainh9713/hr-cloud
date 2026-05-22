import { Readable } from "stream";

export interface IAIProvider {
  /**
   * Generates a concise summary, a category classification, and metadata tags for a file.
   */
  generateSummary(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    contentSnippet: string
  ): Promise<{ summary: string; category: string; tags: string[] }>;

  /**
   * Performs Optical Character Recognition (OCR) on image or document data.
   */
  performOCR(mimeType: string, buffer: Buffer): Promise<string>;

  /**
   * Chats with the AI using context of a file or storage drive workspace.
   */
  chat(
    messages: { role: "user" | "model" | "system"; content: string }[],
    fileContext: string,
    storageContext: string
  ): Promise<string>;

  /**
   * Translates a natural language query into structured semantic queries or database filters.
   */
  parseSemanticQuery(query: string): Promise<{
    originalQuery: string;
    filters?: {
      mimeType?: string;
      sizeMin?: number;
      sizeMax?: number;
      dateMin?: string;
      dateMax?: string;
      tags?: string[];
      isStarred?: boolean;
    };
    keywords?: string[];
  }>;

  /**
   * Generates a semantic vector embedding array for the given text.
   */
  generateEmbedding(text: string): Promise<number[]>;
}
