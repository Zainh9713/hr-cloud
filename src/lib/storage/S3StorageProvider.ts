import { IStorageProvider } from "./IStorageProvider";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { logger } from "../logger";

export class S3StorageProvider implements IStorageProvider {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || "";
    
    // Support AWS S3, Cloudflare R2, Supabase, DigitalOcean Spaces based on endpoint
    this.s3 = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT, // Optional custom endpoint for R2/Supabase
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ""
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" // Required for some S3-compatibles like MinIO/Supabase
    });
  }

  async uploadFile(userId: string, storedName: string, fileData: Buffer | Readable): Promise<{ path: string; key: string }> {
    const key = `uploads/${userId}/${storedName}`;

    // If it's a Buffer, we can pass it directly to Body
    // If it's a Readable stream, AWS SDK v3 handles it directly in Node
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileData,
    });

    try {
      await this.s3.send(command);
      return { path: key, key };
    } catch (error) {
      logger.error(`S3 Upload failed for key: ${key}`, error);
      throw new Error(`Failed to upload file to S3 compatible storage: ${error}`);
    }
  }

  async downloadFileStream(path: string, options?: { start?: number; end?: number }): Promise<Readable> {
    const commandOptions: any = {
      Bucket: this.bucket,
      Key: path
    };

    if (options && options.start !== undefined && options.end !== undefined) {
      commandOptions.Range = `bytes=${options.start}-${options.end}`;
    }

    const command = new GetObjectCommand(commandOptions);

    try {
      const response = await this.s3.send(command);
      return response.Body as Readable;
    } catch (error) {
      logger.error(`S3 Download failed for key: ${path}`, error);
      throw new Error(`Failed to download file from S3: ${error}`);
    }
  }

  async deleteFile(path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path
    });

    try {
      await this.s3.send(command);
    } catch (error) {
      logger.error(`S3 Deletion failed for key: ${path}`, error);
      throw new Error(`Failed to delete file from S3: ${error}`);
    }
  }

  async getFileUrl(path: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path
    });

    try {
      // Generate a signed URL that expires in 1 hour
      return await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    } catch (error) {
      logger.error(`S3 getSignedUrl failed for key: ${path}`, error);
      throw new Error(`Failed to generate signed URL: ${error}`);
    }
  }
}
