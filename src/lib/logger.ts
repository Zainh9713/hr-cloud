type LogLevel = "info" | "warn" | "error" | "security" | "perf";

class Logger {
  public metrics = {
    uploadFailures: 0,
    chunkFailures: 0,
    websocketDisconnects: 0,
    aiFailures: 0,
    queueFailures: 0,
    storageFailures: 0,
    dbBottlenecks: 0,
    securityViolations: 0,
    totalLogs: 0
  };

  private formatMessage(level: LogLevel, message: string, context?: any) {
    const timestamp = new Date().toISOString();
    const ctxString = context ? ` | Context: ${JSON.stringify(context)}` : "";
    this.metrics.totalLogs++;
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${ctxString}`;
  }

  public trackMetric(name: keyof typeof this.metrics) {
    if (this.metrics[name] !== undefined) {
      this.metrics[name]++;
    }
  }

  public info(message: string, context?: any) {
    console.log(this.formatMessage("info", message, context));
  }

  public warn(message: string, context?: any) {
    console.warn(this.formatMessage("warn", message, context));
  }

  public error(message: string, error?: any, context?: any) {
    const errCtx = error 
      ? { ...context, errorMessage: error.message, stack: error.stack } 
      : context;
    
    // Auto-detect failure categories from message content to populate metrics
    const msgLower = message.toLowerCase();
    if (msgLower.includes("upload") && msgLower.includes("chunk")) {
      this.metrics.chunkFailures++;
    } else if (msgLower.includes("upload")) {
      this.metrics.uploadFailures++;
    } else if (msgLower.includes("websocket") || msgLower.includes("socket") || msgLower.includes("ws")) {
      this.metrics.websocketDisconnects++;
    } else if (msgLower.includes("ai") || msgLower.includes("gemini") || msgLower.includes("summarize")) {
      this.metrics.aiFailures++;
    } else if (msgLower.includes("queue") || msgLower.includes("job")) {
      this.metrics.queueFailures++;
    } else if (msgLower.includes("storage") || msgLower.includes("disk") || msgLower.includes("s3") || msgLower.includes("cloudinary")) {
      this.metrics.storageFailures++;
    }

    console.error(this.formatMessage("error", message, errCtx));
    // Sentry / Logtail integration hook can be added here
  }

  public security(message: string, context?: any) {
    this.metrics.securityViolations++;
    console.warn(this.formatMessage("security", `🚨 SECURITY VIOLATION: ${message}`, context));
  }

  public perf(operationName: string, durationMs: number, context?: any) {
    if (durationMs > 1000) {
      // Flag db bottleneck if database query or file listing takes > 1000ms
      const nameLower = operationName.toLowerCase();
      if (nameLower.includes("db") || nameLower.includes("query") || nameLower.includes("find") || nameLower.includes("save")) {
        this.metrics.dbBottlenecks++;
      }
    }
    console.log(
      this.formatMessage(
        "perf", 
        `⏱️ PERFORMANCE: [${operationName}] took ${durationMs.toFixed(2)}ms`, 
        context
      )
    );
  }
}

export const logger = new Logger();

