import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDB from "@/lib/db";
import SharedLink from "@/models/SharedLink";
import FileModel from "@/models/File";
import FolderModel from "@/models/Folder";
import { ShareService } from "@/services/ShareService";
import { StorageFactory } from "@/lib/storage/StorageFactory";
import { Readable } from "stream";

function nodeStreamToWebStream(nodeStream: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      nodeStream.on("end", () => {
        controller.close();
      });
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const requestedFileId = searchParams.get("fileId");

    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const cookieStore = await cookies();
    const password = searchParams.get("password") || request.headers.get("x-share-password") || cookieStore.get(`share_pass_${token}`)?.value;
    const email = searchParams.get("email") || request.headers.get("x-share-email") || cookieStore.get(`share_email_${token}`)?.value;

    await connectDB();

    // 1. Validate share link existence and base status
    const share = await ShareService.validateShareAccess(token, { password, email });

    let targetFile = null;

    if (share.fileId) {
      // Direct file share
      targetFile = await FileModel.findById(share.fileId);
    } else if (share.folderId && requestedFileId) {
      // Folder share access to a specific sub-file
      const file = await FileModel.findById(requestedFileId);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      // Recursively walk parentFolderId to check if it descends from the shared folder
      let parentId = file.parentFolderId?.toString();
      let isDescendant = false;
      while (parentId) {
        if (parentId === share.folderId.toString()) {
          isDescendant = true;
          break;
        }
        const parentFolder = await FolderModel.findById(parentId);
        parentId = parentFolder?.parentFolderId?.toString();
      }

      if (!isDescendant) {
        return NextResponse.json({ error: "Access Denied: File not in shared directory" }, { status: 403 });
      }
      targetFile = file;
    } else {
      return NextResponse.json({ error: "Target asset not specified or invalid" }, { status: 400 });
    }

    if (!targetFile || targetFile.isTrash) {
      return NextResponse.json({ error: "File not found or has been deleted" }, { status: 404 });
    }

    // 2. Parse range headers for partial streaming
    let totalSize = targetFile.size;
    let start = 0;
    let end = totalSize - 1;
    let isRangeRequest = false;

    const rangeHeader = request.headers.get("range");
    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      isRangeRequest = true;
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const startPart = parts[0];
      const endPart = parts[1];

      if (startPart) start = parseInt(startPart, 10);
      if (endPart) {
        end = parseInt(endPart, 10);
      } else {
        end = totalSize - 1;
      }

      if (start >= totalSize || start < 0) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalSize}`,
            "Accept-Ranges": "bytes"
          }
        });
      }
      if (end >= totalSize) end = totalSize - 1;
    }

    // 3. Log download/stream access
    const ip = request.headers.get("x-forwarded-for") || null;
    const userAgent = request.headers.get("user-agent") || null;
    await ShareService.logAccess(share._id.toString(), "download", ip, userAgent);

    // 4. Retrieve streaming handle from storage provider
    const storageProvider = StorageFactory.getProvider();
    const stream = await storageProvider.downloadFileStream(
      targetFile.path,
      isRangeRequest ? { start, end } : undefined
    );

    const webStream = nodeStreamToWebStream(stream);

    const headers = new Headers();
    headers.set("Content-Type", targetFile.mimeType || "application/octet-stream");
    headers.set("Accept-Ranges", "bytes");

    const encodedName = encodeURIComponent(targetFile.originalName);
    headers.set("Content-Disposition", `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);

    if (isRangeRequest) {
      const contentLength = end - start + 1;
      headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      headers.set("Content-Length", contentLength.toString());
      return new NextResponse(webStream, { status: 206, headers });
    } else {
      headers.set("Content-Length", totalSize.toString());
      return new NextResponse(webStream, { status: 200, headers });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
