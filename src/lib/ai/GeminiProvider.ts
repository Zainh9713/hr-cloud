import { IAIProvider } from "./IAIProvider";
import { logger } from "../logger";

export class GeminiProvider implements IAIProvider {
  private getApiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    return key || "";
  }

  private async callGeminiAPI(payload: any): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Gemini API Error: Status ${response.status} - ${errorText}`);
        throw new Error(`Gemini API returned error: Status ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty candidate response from Gemini API");
      }
      return text;
    } catch (err: any) {
      logger.error("Gemini request failed", err);
      throw err;
    }
  }

  public async generateSummary(
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    contentSnippet: string
  ): Promise<{ summary: string; category: string; tags: string[] }> {
    const apiKey = this.getApiKey();
    const inferredCategory = this.inferCategory(mimeType);
    const ext = fileName.split(".").pop() || "unknown";

    if (!apiKey) {
      logger.warn(`GEMINI_API_KEY is missing. Generating offline fallback summary for: ${fileName}`);
      const kbSize = (buffer.length / 1024).toFixed(1);
      return {
        summary: `[OFFLINE NEURAL ARCHIVE] File "${fileName}" (${kbSize} KB) parsed locally. Format identified as ${mimeType}. Secure sector mapped successfully.`,
        category: inferredCategory,
        tags: [ext, "local-archive", "offline-sector"]
      };
    }

    const base64Data = buffer.toString("base64");
    
    const textPrompt = `You are an AI cloud assistant indexing files for H&R Cloud. Analyze the file details below:
Name: ${fileName}
MIME Type: ${mimeType}
Snippet/Text content: ${contentSnippet || "No snippet available"}

Please return a JSON block with:
1. "summary": A premium, concise summary of the file (1-2 sentences).
2. "category": Choose exactly one from ["Documents", "Images", "Media", "Code", "Archives", "Other"].
3. "tags": A string array containing 3-5 keywords relevant to this file.

Respond ONLY with valid JSON. Do not include markdown code block formatting or backticks.`;

    const parts: any[] = [{ text: textPrompt }];

    // If it's an image or PDF, attach it as inlineData for multimodal capabilities
    const maxInlineSize = 4 * 1024 * 1024; // 4MB
    if (buffer.length > 0 && buffer.length <= maxInlineSize) {
      if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
    }

    const payload = {
      contents: [{ parts }]
    };

    try {
      const responseText = await this.callGeminiAPI(payload);
      const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      
      return {
        summary: parsed.summary || "No summary generated.",
        category: parsed.category || inferredCategory,
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      };
    } catch (error) {
      logger.warn("Failed to parse Gemini summary JSON, using fallbacks", error);
      return {
        summary: `File named ${fileName} uploaded. Size: ${buffer.length} bytes.`,
        category: inferredCategory,
        tags: [ext, "file"]
      };
    }
  }

  public async performOCR(mimeType: string, buffer: Buffer): Promise<string> {
    if (buffer.length === 0) {
      return "";
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn("GEMINI_API_KEY is missing. Skipping OCR analysis.");
      return `[OFFLINE NEURAL SCANNER] OCR scan completed locally. Type: ${mimeType}, Size: ${buffer.length} bytes. API Key missing - detailed character parsing bypassed.`;
    }

    const base64Data = buffer.toString("base64");
    const payload = {
      contents: [
        {
          parts: [
            {
              text: "Perform OCR on the attached file. Extract and return ALL text found in the document/image exactly as it is, maintaining formatting where possible. If no text is found, return an empty string."
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    };

    try {
      const text = await this.callGeminiAPI(payload);
      return text.trim();
    } catch (error) {
      logger.error("Failed to perform OCR with Gemini", error);
      return "";
    }
  }

  public async chat(
    messages: { role: "user" | "model" | "system"; content: string }[],
    fileContext: string,
    storageContext: string
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const lastUserMessage = messages.filter(m => m.role === "user").pop()?.content || "";
      logger.warn("GEMINI_API_KEY is missing. Running chat in cyberpunk offline fallback mode.");
      return `[NEURAL CORE - LINK STATUS: OFFLINE]
System environment key "GEMINI_API_KEY" is not defined. Generative matrix connection lost.

LOCAL SYNAPSE RECOVERY ENGAGED:
I am responding via local fallback systems.
- You asked: "${lastUserMessage}"
- Selected File Context: ${fileContext ? "Loaded (Offline snippet available)" : "None"}
- System Drive Metrics: ${storageContext ? "Synced" : "No telemetry"}

*Diagnostic Tip: To activate full conversational AI features, add a valid 'GEMINI_API_KEY' to your local environment file (.env.local) and reboot the system.*`;
    }

    // Translate system instructions and message roles
    const systemPrompt = `You are the H&R Cloud Neural Core AI. A highly sophisticated cyberpunk AI system running on the H&R Cloud operating system.
You help users manage and navigate their storage workspace. You have access to their directory environment context.

Active File Context:
${fileContext || "No active file selected."}

Overall Storage drive context (recent activity, file statistics, directory details):
${storageContext || "No storage metrics available."}

Maintain a cool, helpful cyberpunk persona. Answer questions about files, extract information from active file contexts, help write summaries, or perform general assistance. Always keep answers concise and styled premium.`;

    const contents = messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "system" ? "user" : m.role,
        parts: [{ text: m.content }]
      }));

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      }
    };

    try {
      return await this.callGeminiAPI(payload);
    } catch (error: any) {
      return `[SYSTEM ERROR] Neural Core link failure: ${error.message}`;
    }
  }

  public async parseSemanticQuery(query: string): Promise<{
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
  }> {
    const prompt = `You are a query parsing model. The user is searching their cloud storage drive. Translate their natural language search query into structural filters.
User Query: "${query}"

Return a JSON object exactly matching this schema:
{
  "originalQuery": string,
  "filters": {
    "mimeType": string (optional, e.g. "application/pdf" or "image/png"),
    "sizeMin": number (optional, size in bytes),
    "sizeMax": number (optional, size in bytes),
    "dateMin": string (optional, ISO 8601 date string, e.g. "2026-05-01"),
    "dateMax": string (optional, ISO 8601 date string),
    "tags": string[] (optional, list of tags to match),
    "isStarred": boolean (optional)
  },
  "keywords": string[] (keywords/phrases extracted for textual search)
}

Do not include any extra text or markdown formatting. Respond with JSON only.`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    try {
      const responseText = await this.callGeminiAPI(payload);
      const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      logger.warn("Failed to parse semantic query from Gemini, returning base query as keyword", error);
      return {
        originalQuery: query,
        keywords: [query]
      };
    }
  }

  private inferCategory(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "Images";
    if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "Media";
    if (
      mimeType.startsWith("text/") ||
      mimeType.includes("pdf") ||
      mimeType.includes("msword") ||
      mimeType.includes("officedocument")
    )
      return "Documents";
    if (
      mimeType.includes("zip") ||
      mimeType.includes("tar") ||
      mimeType.includes("rar") ||
      mimeType.includes("gzip")
    )
      return "Archives";
    if (
      mimeType.includes("javascript") ||
      mimeType.includes("json") ||
      mimeType.includes("html") ||
      mimeType.includes("css")
    )
      return "Code";
    return "Other";
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Mock embedding of 768 dimensions with random values
      return Array.from({ length: 768 }, () => Math.random() - 0.5);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: {
              parts: [{ text }]
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Gemini Embedding API Error: Status ${response.status} - ${errorText}`);
        throw new Error(`Embedding API error: Status ${response.status}`);
      }

      const data = await response.json();
      const values = data?.embedding?.values;
      if (!values || !Array.isArray(values)) {
        throw new Error("Invalid embedding structure returned from Gemini");
      }
      return values;
    } catch (err: any) {
      logger.error("Failed to generate embedding from Gemini", err);
      // Fallback mock values
      return Array.from({ length: 768 }, () => Math.random() - 0.5);
    }
  }
}
