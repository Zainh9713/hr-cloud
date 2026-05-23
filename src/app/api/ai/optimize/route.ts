import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import Folder from "@/models/Folder";
import { FileService } from "@/services/FileService";
import { FolderService } from "@/services/FolderService";
import { backgroundJobQueue } from "@/services/BackgroundJobService";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = verifyToken(token) as { id: string } | null;
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    // Query active files and folders
    const files = await FileModel.find({ ownerId: decoded.id, isTrash: { $ne: true } });
    const folders = await Folder.find({ ownerId: decoded.id, isTrash: { $ne: true } });

    const suggestions = [];

    // 1. Detect Duplicates by hash, or name+size if hash is empty
    const duplicatesMap = new Map<string, typeof files>();
    for (const file of files) {
      const key = file.hash || `${file.originalName}_${file.size}`;
      if (!duplicatesMap.has(key)) {
        duplicatesMap.set(key, []);
      }
      duplicatesMap.get(key)!.push(file);
    }

    for (const [_, group] of duplicatesMap.entries()) {
      if (group.length > 1) {
        // Keep the oldest/first uploaded file, recommend deleting others
        const sortedGroup = [...group].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const original = sortedGroup[0];
        for (let i = 1; i < sortedGroup.length; i++) {
          const duplicate = sortedGroup[i];
          suggestions.push({
            id: `dup_${duplicate._id}`,
            type: "duplicate",
            title: "Duplicate Asset Detected",
            spaceSaved: `${(duplicate.size / 1024 / 1024).toFixed(2)} MB`,
            description: `"${duplicate.originalName}" is a duplicate of "${original.originalName}".`,
            actionText: "Purge Duplicate",
            payload: { action: "delete_file", fileId: duplicate._id }
          });
        }
      }
    }

    // 2. Detect Un-summarized files (limit to 2 suggestions to prevent clutter)
    const unsummarizedFiles = files.filter(f => !f.aiSummary);
    const filesToSummarize = unsummarizedFiles.slice(0, 2);
    for (const file of filesToSummarize) {
      suggestions.push({
        id: `ai_${file._id}`,
        type: "zap",
        title: "Generate AI Insights",
        spaceSaved: "0.0 MB",
        description: `Compile cybersecurity metadata, categorization, and smart tags for "${file.originalName}".`,
        actionText: "Run AI Analysis",
        payload: { action: "ai_summarize", fileId: file._id }
      });
    }

    // 3. Detect Empty folders
    for (const folder of folders) {
      const hasFiles = files.some(f => f.parentFolderId?.toString() === String(folder._id));
      const hasFolders = folders.some(f => f.parentId?.toString() === String(folder._id));
      if (!hasFiles && !hasFolders) {
        suggestions.push({
          id: `empty_${folder._id}`,
          type: "archive",
          title: "Empty Sector Found",
          spaceSaved: "0.0 MB",
          description: `Folder sector "${folder.name}" contains no data nodes.`,
          actionText: "Decompile Sector",
          payload: { action: "delete_folder", folderId: folder._id }
        });
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to compile recommendations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = verifyToken(token) as { id: string } | null;
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, fileId, folderId } = await req.json();
    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    await connectDB();

    if (action === "delete_file") {
      if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });
      await FileService.deleteFile(decoded.id, fileId);
      return NextResponse.json({ success: true, message: "Duplicate asset moved to trash" });
    }

    if (action === "delete_folder") {
      if (!folderId) return NextResponse.json({ error: "folderId is required" }, { status: 400 });
      await FolderService.updateFolder(decoded.id, folderId, { isTrash: true });
      return NextResponse.json({ success: true, message: "Empty folder sector moved to trash" });
    }

    if (action === "ai_summarize") {
      if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });
      
      // Enqueue job in background processing queue
      const job = await backgroundJobQueue.enqueue(decoded.id, "AI_SUMMARIZE", {
        fileId,
        userId: decoded.id
      });
      
      return NextResponse.json({ 
        success: true, 
        jobId: String(job._id),
        message: "Neural analysis enqueued in background sector" 
      });
    }

    return NextResponse.json({ error: "Unknown action protocol" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to execute optimization protocol" }, { status: 500 });
  }
}
