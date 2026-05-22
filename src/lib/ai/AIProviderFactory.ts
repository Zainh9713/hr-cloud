import { IAIProvider } from "./IAIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { ClaudeProvider } from "./ClaudeProvider";

export class AIProviderFactory {
  private static provider: IAIProvider | null = null;

  public static getProvider(): IAIProvider {
    if (this.provider) {
      return this.provider;
    }

    const type = (process.env.AI_PROVIDER || "gemini").toLowerCase();

    switch (type) {
      case "openai":
        this.provider = new OpenAIProvider();
        break;
      case "claude":
        this.provider = new ClaudeProvider();
        break;
      case "gemini":
      default:
        this.provider = new GeminiProvider();
        break;
    }

    return this.provider;
  }
}
