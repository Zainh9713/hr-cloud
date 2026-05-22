import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import UploadSession from "@/models/UploadSession";
import connectDB from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");
    const fileSizeParam = searchParams.get("fileSize");
    const hash = searchParams.get("hash");
    const parentFolderId = searchParams.get("folderId") || null;

    if (!fileName || !fileSizeParam || !hash) {
      return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
    }

    const fileSize = parseInt(fileSizeParam, 10);
    await connectDB();

    // Look for an existing, incomplete upload session for this file hash and user
    let session = await UploadSession.findOne({
      userId,
      hash,
      originalName: fileName,
      fileSize
    });

    if (session) {
      // Re-verify the chunks directory exists, if some chunks were already written
      const chunkDir = path.join(process.cwd(), "uploads", "chunks", session.uploadId);
      if (!fs.existsSync(chunkDir)) {
        session.uploadedChunks = [];
        await session.save();
      } else {
        // Double-check the actual files match the index list
        const files = await fsPromises.readdir(chunkDir);
        const actualChunks = files
          .map((f) => parseInt(f, 10))
          .filter((n) => !isNaN(n));
        session.uploadedChunks = session.uploadedChunks.filter((c: number) => actualChunks.includes(c));
        await session.save();
      }

      return NextResponse.json({
        uploadId: session.uploadId,
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        resumed: true
      });
    }

    // Otherwise, create a new session
    const uploadId = uuidv4();
    const chunkLength = 2 * 1024 * 1024; // 2MB chunks
    const totalChunks = Math.ceil(fileSize / chunkLength);

    session = await UploadSession.create({
      uploadId,
      userId,
      originalName: fileName,
      fileSize,
      mimeType: "application/octet-stream", // Fallback, updated during merge
      parentFolderId: parentFolderId === "null" || !parentFolderId ? null : parentFolderId,
      totalChunks,
      uploadedChunks: [],
      hash
    });

    const chunkDir = path.join(process.cwd(), "uploads", "chunks", uploadId);
    await fsPromises.mkdir(chunkDir, { recursive: true });

    return NextResponse.json({
      uploadId,
      uploadedChunks: [],
      totalChunks,
      resumed: false
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadId = "unknown";
  let chunkIndex = -1;
  let userId = "unknown";

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const resolvedUserId = await AuthService.getUserIdFromToken(token);

    if (!resolvedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = resolvedUserId.toString();

    const formData = await request.formData();
    uploadId = (formData.get("uploadId") as string) || "unknown";
    const chunkIndexParam = formData.get("chunkIndex") as string;
    const chunkFile = formData.get("chunk") as Blob | null;

    if (!uploadId || !chunkIndexParam || !chunkFile) {
      return NextResponse.json({ error: "Missing upload metadata or chunk content" }, { status: 400 });
    }

    chunkIndex = parseInt(chunkIndexParam, 10);
    await connectDB();

    // Check if session exists first (read-only validation)
    const sessionExists = await UploadSession.exists({ uploadId, userId });
    if (!sessionExists) {
      logger.warn("Upload session not found during chunk upload attempt", { uploadId, chunkIndex, userId });
      return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
    }

    // Save chunk to disk in uploads/chunks/{uploadId}/{chunkIndex}
    const chunkDir = path.join(process.cwd(), "uploads", "chunks", uploadId);
    await fsPromises.mkdir(chunkDir, { recursive: true });
    
    const chunkPath = path.join(chunkDir, chunkIndex.toString());
    const arrayBuffer = await chunkFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write file to disk
    await fsPromises.writeFile(chunkPath, buffer);

    // Verify file size on disk matches the uploaded chunk size
    const stat = await fsPromises.stat(chunkPath);
    if (stat.size !== chunkFile.size) {
      // Cleanup corrupt file
      try { await fsPromises.unlink(chunkPath); } catch {}
      throw new Error(`Chunk write verification failed: size on disk (${stat.size}) does not match expected size (${chunkFile.size})`);
    }

    // Atomically push the chunk index to uploadedChunks array using $addToSet
    const session = await UploadSession.findOneAndUpdate(
      { uploadId, userId },
      { $addToSet: { uploadedChunks: chunkIndex } },
      { new: true }
    );

    if (!session) {
      // Cleanup file if session was deleted in the background
      try { await fsPromises.unlink(chunkPath); } catch {}
      return NextResponse.json({ error: "Upload session terminated" }, { status: 404 });
    }

    // Sort returned array in-memory for response compatibility
    const sortedUploadedChunks = [...session.uploadedChunks].sort((a: number, b: number) => a - b);

    logger.info("Chunk received and verified successfully", { 
      uploadId, 
      chunkIndex, 
      userId, 
      chunkSize: chunkFile.size,
      totalChunks: session.totalChunks 
    });

    return NextResponse.json({
      success: true,
      uploadedChunks: sortedUploadedChunks
    });
  } catch (err: any) {
    logger.error("Chunk upload processing failed", err, { uploadId, chunkIndex, userId });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
