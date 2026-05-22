import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FileService } from "@/services/FileService";
import { Readable } from "stream";

// Helper to convert NodeJS.ReadableStream to Web ReadableStream
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
    const id = searchParams.get("id");
    const downloadToken = searchParams.get("token");
    const preview = searchParams.get("preview") === "true";
    const versionStr = searchParams.get("version");

    let userId: string | null = null;
    let targetFileId = id;

    if (downloadToken) {
      const { verifyDownloadToken } = await import("@/lib/middleware/security");
      const decoded = verifyDownloadToken(downloadToken);
      userId = decoded.userId;
      targetFileId = decoded.fileId;
    } else {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("token")?.value;
      userId = await AuthService.getUserIdFromToken(sessionToken);
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!targetFileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    const version = versionStr ? parseInt(versionStr, 10) : undefined;
    
    // Fetch file metadata to determine size
    const file = await FileService.getFile(userId, targetFileId);
    let totalSize = file.size;
    if (version !== undefined) {
      const match = file.versionHistory.find((v: any) => v.version === version);
      if (!match) {
        return NextResponse.json({ error: `Version ${version} of file not found` }, { status: 404 });
      }
      totalSize = match.size;
    }

    let start = 0;
    let end = totalSize - 1;
    let isRangeRequest = false;

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
            "Accept-Ranges": "bytes"
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

    const { stream, originalName, mimeType } = await FileService.downloadFileStream(
      userId,
      targetFileId,
      version,
      isRangeRequest ? { start, end } : undefined
    );

    const webStream = nodeStreamToWebStream(stream);

    const headers = new Headers();
    headers.set("Content-Type", mimeType || "application/octet-stream");
    headers.set("Accept-Ranges", "bytes");
    
    const encodedName = encodeURIComponent(originalName);
    if (preview) {
      headers.set("Content-Disposition", `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    } else {
      headers.set("Content-Disposition", `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    }

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
