import { IAIProvider } from "./IAIProvider";
import { logger } from "../logger";

export class OpenAIProvider implements IAIProvider {
  public async generateSummary(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    contentSnippet: string
  ): Promise<{ summary: string; category: string; tags: string[] }> {
    logger.warn("OpenAIProvider.generateSummary is not implemented. Using stubs.");
    return {
      summary: `[OpenAI Stub] Summary for ${fileName}`,
      category: "Other",
      tags: ["stub", "openai"]
    };
  }

  public async performOCR(mimeType: string, buffer: Buffer): Promise<string> {
    logger.warn("OpenAIProvider.performOCR is not implemented.");
    return "[OpenAI Stub] OCR content";
  }

  public async chat(
    messages: { role: "user" | "model" | "system"; content: string }[],
    fileContext: string,
    storageContext: string
  ): Promise<string> {
    logger.warn("OpenAIProvider.chat is not implemented.");
    return "[OpenAI Stub] Chat response";
  }

  public async parseSemanticQuery(query: string): Promise<any> {
    logger.warn("OpenAIProvider.parseSemanticQuery is not implemented.");
    return {
      originalQuery: query,
      keywords: [query]
    };
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    logger.warn("OpenAIProvider.generateEmbedding is not implemented.");
    return Array.from({ length: 768 }, () => Math.random() - 0.5);
  }
}
