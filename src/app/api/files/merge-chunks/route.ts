import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FileService } from "@/services/FileService";
import UploadSession from "@/models/UploadSession";
import connectDB from "@/lib/db";
import crypto from "crypto";
import path from "path";
import fsPromises from "fs/promises";
import fs from "fs";
import { backgroundJobQueue } from "@/services/BackgroundJobService";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  let uploadId = "unknown";
  let userId = "unknown";

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const resolvedUserId = await AuthService.getUserIdFromToken(token);

    if (!resolvedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = resolvedUserId.toString();

    const { uploadId: reqUploadId, mimeType } = await request.json();
    uploadId = reqUploadId;

    if (!uploadId) {
      return NextResponse.json({ error: "Missing upload ID" }, { status: 400 });
    }

    await connectDB();
    const session = await UploadSession.findOne({ uploadId, userId });
    if (!session) {
      logger.warn("Upload session not found during merge request", { uploadId, userId });
      return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
    }

    // Verify all chunk indexes are present in the uploadedChunks array
    const missingChunks = [];
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.uploadedChunks.includes(i)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      logger.warn("Merge rejected: missing uploaded chunks", { 
        uploadId, 
        userId, 
        missingChunks, 
        totalChunks: session.totalChunks 
      });
      return NextResponse.json({ 
        error: "Upload incomplete", 
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        missingChunks
      }, { status: 400 });
    }

    logger.info("Starting sequential file chunks merge", { uploadId, userId, totalChunks: session.totalChunks });

    const chunkDir = path.join(process.cwd(), "uploads", "chunks", uploadId);
    const tempMergedPath = path.join(chunkDir, "merged_temp");
    let fileRecord: any = null;
    let errorOccurred = false;

    // Sequential stream-based merge
    const writeStream = fs.createWriteStream(tempMergedPath);
    const hashHasher = crypto.createHash("md5");

    try {
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(chunkDir, i.toString());
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Chunk file ${i} missing from disk`);
        }

        const chunkReadStream = fs.createReadStream(chunkPath);
        
        await new Promise<void>((resolve, reject) => {
          chunkReadStream.pipe(writeStream, { end: false });
          
          chunkReadStream.on("data", (chunk) => {
            hashHasher.update(chunk);
          });
          
          chunkReadStream.on("end", () => {
            resolve();
          });
          
          chunkReadStream.on("error", (err) => {
            chunkReadStream.destroy();
            reject(err);
          });
        });
      }
    } catch (mergeErr) {
      errorOccurred = true;
      throw mergeErr;
    } finally {
      // Wait for writeStream to finish writing and close
      await new Promise<void>((resolve) => {
        writeStream.end(() => {
          resolve();
        });
      });
      if (errorOccurred) {
        try { await fsPromises.unlink(tempMergedPath); } catch {}
      }
    }

    const finalHash = hashHasher.digest("hex");

    // Validate checksum integrity if expected hash is present (skip client-side session metadata keys)
    const isSessionKey = session.hash && session.hash.startsWith("h_");
    if (session.hash && !isSessionKey && finalHash !== session.hash) {
      try { await fsPromises.unlink(tempMergedPath); } catch {}
      logger.error("Data integrity verification failed: checksum mismatch", null, {
        uploadId,
        userId,
        expectedHash: session.hash,
        actualHash: finalHash
      });
      return NextResponse.json({ 
        error: "Data integrity verification failed. MD5 Checksum mismatch." 
      }, { status: 422 });
    }

    // Upload to target storage provider
    const resolvedMime = mimeType || session.mimeType || "application/octet-stream";
    const fileReadStream = fs.createReadStream(tempMergedPath);
    
    fileRecord = await FileService.uploadFile(
      userId,
      session.originalName,
      fileReadStream,
      resolvedMime,
      session.parentFolderId ? session.parentFolderId.toString() : null,
      session.fileSize,
      finalHash
    );

    logger.info("File upload finalized successfully through storage provider", {
      uploadId,
      userId,
      fileId: fileRecord._id,
      finalHash,
      fileSize: session.fileSize
    });

    // Clean up temporary chunk files and folder
    try {
      await fsPromises.unlink(tempMergedPath);
      for (let i = 0; i < session.totalChunks; i++) {
        await fsPromises.unlink(path.join(chunkDir, i.toString()));
      }
      await fsPromises.rmdir(chunkDir);
    } catch (cleanupErr) {
      logger.warn("Failed to cleanup temporary chunk directories", { uploadId, cleanupErr });
    }

    // Delete session
    await UploadSession.deleteOne({ _id: session._id });

    // Trigger AI summarization or OCR in background
    try {
      await backgroundJobQueue.enqueue(userId, "AI_SUMMARIZE", {
        fileId: fileRecord._id.toString(),
        userId
      });
    } catch (jobErr) {
      logger.error("Failed to spawn background AI analysis job", jobErr, { fileId: fileRecord._id });
    }

    return NextResponse.json({
      success: true,
      file: fileRecord
    });
  } catch (err: any) {
    logger.error("File merge operation failed", err, { uploadId, userId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
