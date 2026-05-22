import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import { Readable } from "stream";

// Helper to convert NodeJS.ReadableStream to Web ReadableStream
function nodeStreamToWebStream(nodeStream: fs.ReadStream): ReadableStream {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string; filename: string }> }
) {
  try {
    const { userId, filename } = await params;

    if (!userId || !filename) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const decodedFilename = decodeURIComponent(filename);

    // 1. Resolve and prevent directory traversal (normalize paths strictly)
    const storageRootDir = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");
    // Normalize both paths using path.normalize and resolving absolute, then switch slashes for consistency
    const userDir = path.normalize(path.resolve(storageRootDir, userId)).replace(/\\/g, "/");
    const filePath = path.normalize(path.resolve(storageRootDir, userId, decodedFilename)).replace(/\\/g, "/");

    if (!filePath.startsWith(userDir + "/") && filePath !== userDir) {
      return NextResponse.json({ error: "Security Exception: Access Denied" }, { status: 403 });
    }


    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 2. Fetch MIME type from database where possible
    let mimeType = "";
    let originalName = decodedFilename;

    try {
      await connectDB();
      let fileRecord = await FileModel.findOne({ storedName: decodedFilename, ownerId: userId });
      if (!fileRecord) {
        // Fallback: Check if it matches a version stored name
        fileRecord = await FileModel.findOne({
          ownerId: userId,
          "versionHistory.storedName": decodedFilename
        });
        if (fileRecord) {
          const versionObj = fileRecord.versionHistory.find((v: any) => v.storedName === decodedFilename);
          mimeType = versionObj?.mimeType || "";
          originalName = versionObj?.originalName || decodedFilename;
        }
      } else {
        mimeType = fileRecord.mimeType || "";
        originalName = fileRecord.originalName || decodedFilename;
      }
    } catch (dbErr) {
      console.error("Database lookup error during static serve:", dbErr);
    }

    // Extension-based MIME fallback if database query didn't yield a MIME type
    if (!mimeType) {
      const ext = path.extname(decodedFilename).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".html": "text/html",
        ".css": "text/css",
        ".json": "application/json",
        ".js": "application/javascript",
        ".ts": "application/typescript",
        ".jsx": "text/javascript",
        ".tsx": "text/typescript",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".zip": "application/zip",
        ".rar": "application/vnd.rar"
      };
      mimeType = mimeMap[ext] || "application/octet-stream";
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;

    let start = 0;
    let end = totalSize - 1;
    let isRangeRequest = false;

    // 3. Support range requests for audio/video streaming
    const rangeHeader = request.headers.get("range");
    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      isRangeRequest = true;
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const startPart = parts[0];
      const endPart = parts[1];

      if (startPart) {
        start = parseInt(startPart, 10);
      }
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
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (end >= totalSize) {
        end = totalSize - 1;
      }
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }
    }

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", "*");
    
    const encodedName = encodeURIComponent(originalName);
    headers.set("Content-Disposition", `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);

    if (isRangeRequest) {
      const contentLength = end - start + 1;
      headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      headers.set("Content-Length", contentLength.toString());

      const readStream = fs.createReadStream(filePath, { start, end });
      const webStream = nodeStreamToWebStream(readStream);
      return new NextResponse(webStream, { status: 206, headers });
    } else {
      headers.set("Content-Length", totalSize.toString());
      const readStream = fs.createReadStream(filePath);
      const webStream = nodeStreamToWebStream(readStream);
      return new NextResponse(webStream, { status: 200, headers });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
