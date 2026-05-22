import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import Folder from "@/models/Folder";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(ip: string, limit = 100, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function validateOwnership(userId: string, targetId: string, type: "file" | "folder"): Promise<boolean> {
  await connectDB();
  if (type === "file") {
    const file = await FileModel.findOne({ _id: targetId, ownerId: userId });
    return !!file;
  } else {
    const folder = await Folder.findOne({ _id: targetId, ownerId: userId });
    return !!folder;
  }
}

export function sanitizeFilename(name: string): string {
  // Replace directory traversal characters or illegal chars
  return name.replace(/[\\/:\*\?"<>\|]/g, "_").trim();
}

export function mimeValidator(filename: string, mimeType: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return true;

  const mime = mimeType.toLowerCase();

  // Basic validation rules
  if (mime.startsWith("image/") && !["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return false;
  }
  if (mime.startsWith("video/") && !["mp4", "webm", "ogg", "mov", "avi", "mkv", "3gp"].includes(ext)) {
    return false;
  }
  if (mime.startsWith("audio/") && !["mp3", "wav", "ogg", "aac", "m4a", "flac"].includes(ext)) {
    return false;
  }
  if (mime === "application/pdf" && ext !== "pdf") {
    return false;
  }
  if (
    (mime.includes("msword") || mime.includes("officedocument.wordprocessingml")) &&
    !["doc", "docx"].includes(ext)
  ) {
    return false;
  }
  return true;
}

export function validateFileSignature(buffer: Buffer, expectedMime: string): boolean {
  if (buffer.length < 4) return true; // Too small to verify signature securely

  const mime = expectedMime.toLowerCase();
  
  // 1. JPEG: FF D8 FF
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  
  // 2. PNG: 89 50 4E 47
  if (mime === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  
  // 3. GIF: 47 49 46 38 ('GIF8')
  if (mime === "image/gif") {
    return buffer.slice(0, 4).toString("ascii") === "GIF8";
  }
  
  // 4. PDF: 25 50 44 46 ('%PDF')
  if (mime === "application/pdf") {
    return buffer.slice(0, 4).toString("ascii") === "%PDF";
  }
  
  // 5. ZIP (includes docx, xlsx, pptx): 50 4B 03 04 ('PK\x03\x04')
  if (mime === "application/zip" || mime === "application/x-zip-compressed") {
    return buffer[0] === 0x50 && buffer[1] === 0x4B;
  }

  // Fallback to true for plain text/unknown formats which don't have binary headers
  return true;
}

export function generateDownloadToken(userId: string, fileId: string): string {
  const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
  return require("jsonwebtoken").sign({ userId, fileId }, jwtSecret, { expiresIn: "5m" });
}

export function verifyDownloadToken(token: string): { userId: string; fileId: string } {
  try {
    const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
    return require("jsonwebtoken").verify(token, jwtSecret) as { userId: string; fileId: string };
  } catch (err) {
    throw new Error("Security Violation: Invalid or expired download token");
  }
}
