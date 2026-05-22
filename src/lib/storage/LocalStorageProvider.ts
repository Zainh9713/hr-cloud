import { IStorageProvider } from "./IStorageProvider";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

export class LocalStorageProvider implements IStorageProvider {
  private getStorageRootDir(): string {
    return process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");
  }

  private getUserDir(userId: string): string {
    return path.join(this.getStorageRootDir(), userId);
  }

  public async uploadFile(
    userId: string,
    storedName: string,
    fileData: Buffer | Readable
  ): Promise<{ path: string; key: string }> {
    const userDir = this.getUserDir(userId);
    await fsPromises.mkdir(userDir, { recursive: true });
    
    const filePath = path.join(userDir, storedName);
    if (Buffer.isBuffer(fileData)) {
      await fsPromises.writeFile(filePath, fileData);
    } else {
      const writeStream = fs.createWriteStream(filePath);
      await pipeline(fileData, writeStream);
    }
    
    return {
      path: filePath,
      key: storedName
    };
  }

  public async downloadFileStream(filePath: string, options?: { start?: number; end?: number }): Promise<Readable> {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found on disk: ${filePath}`);
    }
    return fs.createReadStream(resolvedPath, options);
  }

  public async deleteFile(filePath: string): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    try {
      if (fs.existsSync(resolvedPath)) {
        await fsPromises.unlink(resolvedPath);
      }
    } catch (err: any) {
      console.error(`Failed to delete physical file: ${resolvedPath}`, err);
      // Fail silently to avoid breaking database status updates
    }
  }

  public async getFileUrl(filePath: string): Promise<string> {
    // Return relative API endpoint for serving downloads
    return `/api/files/download?path=${encodeURIComponent(filePath)}`;
  }
}
