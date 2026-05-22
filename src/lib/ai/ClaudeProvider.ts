import { IAIProvider } from "./IAIProvider";
import { logger } from "../logger";

export class ClaudeProvider implements IAIProvider {
  public async generateSummary(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    contentSnippet: string
  ): Promise<{ summary: string; category: string; tags: string[] }> {
    logger.warn("ClaudeProvider.generateSummary is not implemented. Using stubs.");
    return {
      summary: `[Claude Stub] Summary for ${fileName}`,
      category: "Other",
      tags: ["stub", "claude"]
    };
  }

  public async performOCR(mimeType: string, buffer: Buffer): Promise<string> {
    logger.warn("ClaudeProvider.performOCR is not implemented.");
    return "[Claude Stub] OCR content";
  }

  public async chat(
    messages: { role: "user" | "model" | "system"; content: string }[],
    fileContext: string,
    storageContext: string
  ): Promise<string> {
    logger.warn("ClaudeProvider.chat is not implemented.");
    return "[Claude Stub] Chat response";
  }

  public async parseSemanticQuery(query: string): Promise<any> {
    logger.warn("ClaudeProvider.parseSemanticQuery is not implemented.");
    return {
      originalQuery: query,
      keywords: [query]
    };
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    logger.warn("ClaudeProvider.generateEmbedding is not implemented.");
    return Array.from({ length: 768 }, () => Math.random() - 0.5);
  }
}
