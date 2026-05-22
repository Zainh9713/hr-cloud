import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FileService } from "@/services/FileService";
import { mimeValidator, sanitizeFilename } from "@/lib/middleware/security";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || null;
    const pageStr = searchParams.get("page");
    const limitStr = searchParams.get("limit");
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    const { files, totalCount } = await FileService.getFiles(userId, folderId, page, limit);
    return NextResponse.json({ files, totalCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Security validation: sanitize filename and validate MIME type
    const sanitizedName = sanitizeFilename(file.name);
    const mimeType = file.type || "application/octet-stream";
    if (!mimeValidator(sanitizedName, mimeType)) {
      return NextResponse.json({ error: "Security Exception: File extension does not match MIME type" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const newFile = await FileService.uploadFile(userId, sanitizedName, buffer, mimeType, folderId);

    // Enqueue background AI summarization job
    try {
      const { backgroundJobQueue } = await import("@/services/BackgroundJobService");
      await backgroundJobQueue.enqueue(userId, "AI_SUMMARIZE", { fileId: newFile._id, userId });
    } catch (queueErr) {
      console.error("Failed to enqueue AI summarization job:", queueErr);
    }

    // Create upload complete notification
    try {
      const { NotificationService } = await import("@/services/NotificationService");
      await NotificationService.createNotification(
        userId,
        "Upload Complete",
        `File "${sanitizedName}" uploaded successfully.`,
        "upload_complete"
      );
    } catch (notifErr) {
      console.error("Failed to create upload completion notification:", notifErr);
    }

    return NextResponse.json({ success: true, file: newFile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, originalName, isStarred, isTrash, tags } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    const file = await FileService.updateFile(userId, id, {
      originalName: originalName ? sanitizeFilename(originalName) : undefined,
      isStarred,
      isTrash,
      tags
    });

    return NextResponse.json(file);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    await FileService.deleteFile(userId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
