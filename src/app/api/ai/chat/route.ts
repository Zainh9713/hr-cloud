import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import FolderModel from "@/models/Folder";
import AICache from "@/models/AICache";
import { AIProviderFactory } from "@/lib/ai/AIProviderFactory";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, fileId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    await connectDB();

    // 1. Compile active file context if provided
    let fileContext = "";
    if (fileId) {
      const file = await FileModel.findOne({ _id: fileId, ownerId: userId });
      if (file) {
        const cached = await AICache.findOne({ hash: file.hash });
        const contentBody = cached?.parsedText || cached?.ocrResult || "No text content available.";
        fileContext = `[Active File Metadata]
ID: ${file._id}
Name: ${file.originalName}
Size: ${file.size} bytes
MIME Type: ${file.mimeType}
AI Category: ${file.aiCategory || "None"}
AI Summary: ${file.aiSummary || "None"}
Tags: ${file.tags?.join(", ") || "None"}

[Active File Extracted Content Snippet]
${contentBody.slice(0, 8000)}`;
      }
    }

    // 2. Compile overall storage drive context
    const fileCount = await FileModel.countDocuments({ ownerId: userId, isTrash: false });
    const folderCount = await FolderModel.countDocuments({ ownerId: userId, isTrash: false });
    const sizeAggregate = await FileModel.aggregate([
      { $match: { ownerId: new mongoose.Types.ObjectId(userId), isTrash: false } },
      { $group: { _id: null, totalSize: { $sum: "$size" } } }
    ]);
    const totalSize = sizeAggregate[0]?.totalSize || 0;

    // Get 10 recent files
    const recentFiles = await FileModel.find({ ownerId: userId, isTrash: false })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select("originalName size mimeType updatedAt");

    const recentFileListStr = recentFiles
      .map(f => `- ${f.originalName} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB) updated at ${f.updatedAt.toISOString()}`)
      .join("\n");

    const storageContext = `[Storage Drive Statistics]
Total Files: ${fileCount}
Total Folders: ${folderCount}
Total Space Consumed: ${(totalSize / (1024 * 1024)).toFixed(2)} MB
Recent Files Active:
${recentFileListStr || "No files uploaded yet."}`;

    // 3. Request completion from active AI provider
    const provider = AIProviderFactory.getProvider();
    const chatResponse = await provider.chat(messages, fileContext, storageContext);

    return NextResponse.json({ message: chatResponse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Ensure mongoose ObjectId is imported correctly for aggregation
import mongoose from "mongoose";
