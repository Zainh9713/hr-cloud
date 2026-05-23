import Job from "@/models/Job";
import { eventBus, EVENTS } from "./EventService";
import connectDB from "@/lib/db";

export type JobHandler = (payload: any, onProgress: (percent: number) => void) => Promise<any>;

class BackgroundJobQueue {
  private static instance: BackgroundJobQueue;
  private handlers = new Map<string, JobHandler>();
  private activeJobsCount = 0;
  private maxConcurrency = 2;
  private queue: string[] = []; // Queue of Job Mongo IDs

  private constructor() {
    // Periodically poll for pending items in DB to ensure resilience
    if (typeof window === "undefined") {
      // Start polling after database connection is verified
      setInterval(() => this.pollForPendingJobs(), 15000);
      this.registerDefaultHandlers();
      this.setupEventBusListeners();
    }
  }

  public static getInstance(): BackgroundJobQueue {
    if (!BackgroundJobQueue.instance) {
      BackgroundJobQueue.instance = new BackgroundJobQueue();
    }
    return BackgroundJobQueue.instance;
  }

  public registerHandler(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  public async enqueue(userId: string, type: string, payload: any): Promise<any> {
    await connectDB();
    const job = await Job.create({
      userId,
      type,
      payload,
      status: "pending"
    });
    this.queue.push(String(job._id));
    this.processQueue();
    return job;
  }

  private async pollForPendingJobs() {
    try {
      await connectDB();
      
      // Crash recovery: Find jobs that got stuck in "running" state (e.g. server restart)
      const stuckJobs = await Job.find({ status: "running" });
      for (const stuck of stuckJobs) {
        if (stuck.attempts < stuck.maxAttempts) {
          stuck.status = "pending";
          stuck.error = "Server interrupted job. Reset to pending.";
          await stuck.save();
          console.log(`[Queue] Recovered orphaned job ${stuck._id} and reset to pending`);
        } else {
          stuck.status = "failed";
          stuck.error = "Server interrupted job. Max attempts exceeded.";
          await stuck.save();
        }
      }

      const pendingJobs = await Job.find({ status: "pending" }).sort({ createdAt: 1 });
      for (const job of pendingJobs) {
        const idStr = String(job._id);
        if (!this.queue.includes(idStr)) {
          this.queue.push(idStr);
        }
      }
      this.processQueue();
    } catch (err) {
      console.error("Failed to poll pending jobs", err);
    }
  }

  private async processQueue() {
    if (this.activeJobsCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const jobId = this.queue.shift();
    if (!jobId) return;

    this.activeJobsCount++;
    this.runJob(jobId).finally(() => {
      this.activeJobsCount--;
      this.processQueue();
    });
  }

  private async runJob(jobId: string) {
    await connectDB();
    const job = await Job.findById(jobId);
    if (!job || job.status !== "pending") return;

    try {
      job.status = "running";
      job.progress = 0;
      job.attempts += 1;
      await job.save();

      console.log(`[Queue] Processing job ${job._id} (Type: ${job.type}, Attempt: ${job.attempts}/${job.maxAttempts})`);

      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No worker registered to handle job type: ${job.type}`);
      }

      const onProgress = async (percent: number) => {
        job.progress = percent;
        await job.save();
        eventBus.emit(EVENTS.JOB_PROGRESS, { jobId, progress: percent });
      };

      const result = await handler(job.payload, onProgress);

      job.status = "completed";
      job.progress = 100;
      job.result = result;
      job.error = null;
      await job.save();

      console.log(`[Queue] Job ${job._id} completed successfully`);
      eventBus.emit(`${EVENTS.JOB_PROGRESS}:completed`, { jobId, result });
    } catch (err: any) {
      console.error(`[Queue] Job ${job._id} failed:`, err);
      
      if (job.attempts < job.maxAttempts) {
        job.status = "pending";
        job.error = err.message || "Intermittent error";
        await job.save();
        
        // Re-enqueue for retry
        this.queue.push(jobId);
        eventBus.emit(`${EVENTS.JOB_PROGRESS}:retry`, { jobId, attempt: job.attempts, error: job.error });
      } else {
        job.status = "failed";
        job.error = err.message || "Execution error";
        await job.save();
        eventBus.emit(`${EVENTS.JOB_PROGRESS}:failed`, { jobId, error: job.error });
      }
    }
  }

  private registerDefaultHandlers() {
    // 1. Recursive Deletion
    this.registerHandler("RECURSIVE_DELETE", async (payload, onProgress) => {
      const { userId, folderId, deletedAt } = payload;
      const { FolderService } = await import("./FolderService");
      onProgress(20);
      await FolderService.deleteFolderRecursively(userId, folderId, new Date(deletedAt));
      onProgress(80);
      const { StorageService } = await import("./StorageService");
      await StorageService.getStorageUsage(userId); // Recalculate usage
      onProgress(100);
      return { success: true, folderId };
    });

    // 2. Storage Recalculation
    this.registerHandler("STORAGE_RECALC", async (payload, onProgress) => {
      const { userId } = payload;
      const { StorageService } = await import("./StorageService");
      onProgress(30);
      const stats = await StorageService.getStorageUsage(userId);
      onProgress(100);
      return stats;
    });

    // 3. Real AI Summarization
    this.registerHandler("AI_SUMMARIZE", async (payload, onProgress) => {
      const { fileId, userId } = payload;
      onProgress(15);
      const { AIService } = await import("./AIService");
      onProgress(45);
      const result = await AIService.summarizeFile(userId, fileId);
      onProgress(100);
      return result;
    });

    // 4. Stub for Image Optimization
    this.registerHandler("IMAGE_OPTIMIZE", async (payload, onProgress) => {
      onProgress(50);
      await new Promise((r) => setTimeout(r, 1000));
      onProgress(100);
      return { success: true };
    });

    // 5. Stub for Duplicate Detection
    this.registerHandler("DUPLICATE_DETECT", async (payload, onProgress) => {
      onProgress(50);
      await new Promise((r) => setTimeout(r, 1000));
      onProgress(100);
      return { success: true };
    });
  }

  private setupEventBusListeners() {
    eventBus.on(EVENTS.JOB_PROGRESS, (data) => {
      const { jobId, progress } = data;
      this.getJobUserId(jobId).then((userId) => {
        if (userId) {
          try {
            const { WebSocketService } = require("@/lib/socket");
            WebSocketService.publish(userId, "job_progress", { jobId, progress });
          } catch (err) {
            console.error("Failed to publish job progress via WS:", err);
          }
        }
      });
    });

    eventBus.on(`${EVENTS.JOB_PROGRESS}:completed`, (data) => {
      const { jobId, result } = data;
      this.handleJobCompleted(jobId, result);
    });

    eventBus.on(`${EVENTS.JOB_PROGRESS}:failed`, (data) => {
      const { jobId, error } = data;
      this.handleJobFailed(jobId, error);
    });
  }

  private async getJobUserId(jobId: string): Promise<string | null> {
    try {
      const job = await Job.findById(jobId);
      return job ? job.userId.toString() : null;
    } catch {
      return null;
    }
  }

  private async handleJobCompleted(jobId: string, result: any) {
    try {
      const job = await Job.findById(jobId);
      if (!job) return;
      
      const userId = job.userId.toString();
      const { NotificationService } = await import("./NotificationService");
      
      if (job.type === "AI_SUMMARIZE") {
        const FileModel = (await import("@/models/File")).default;
        const file = await FileModel.findById(job.payload.fileId);
        const fileName = file ? file.originalName : "Unknown File";
        
        await NotificationService.createNotification(
          userId,
          "AI Analysis Complete",
          `AI neural core analysis completed for "${fileName}".`,
          "ai_analysis"
        );
        
        if (file && file.mimeType.startsWith("image/")) {
          await NotificationService.createNotification(
            userId,
            "OCR Processing Complete",
            `OCR successfully extracted text overlays from "${fileName}".`,
            "ocr_complete"
          );
        }
      }
      
      // Also publish generic job completed socket event
      try {
        const { WebSocketService } = require("@/lib/socket");
        WebSocketService.publish(userId, "job_completed", { jobId, type: job.type, result });
      } catch (wsErr) {
        console.error("Failed to publish job_completed via WS:", wsErr);
      }
      
    } catch (err) {
      console.error("Error handling job completion notifications:", err);
    }
  }

  private async handleJobFailed(jobId: string, error: any) {
    try {
      const job = await Job.findById(jobId);
      if (!job) return;

      const userId = job.userId.toString();
      const { NotificationService } = await import("./NotificationService");

      if (job.type === "AI_SUMMARIZE") {
        const FileModel = (await import("@/models/File")).default;
        const file = await FileModel.findById(job.payload.fileId);
        const fileName = file ? file.originalName : "Unknown File";

        await NotificationService.createNotification(
          userId,
          "AI Analysis Failed",
          `Failed to run AI analysis for file "${fileName}": ${error}`,
          "upload_failed"
        );
      }

      // Also publish generic job failed socket event
      try {
        const { WebSocketService } = require("@/lib/socket");
        WebSocketService.publish(userId, "job_failed", { jobId, type: job.type, error });
      } catch (wsErr) {
        console.error("Failed to publish job_failed via WS:", wsErr);
      }

    } catch (err) {
      console.error("Error handling job failure notifications:", err);
    }
  }
}

export const backgroundJobQueue = BackgroundJobQueue.getInstance();
