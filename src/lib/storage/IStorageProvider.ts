import { Readable } from "stream";

export interface IStorageProvider {
  /**
   * Uploads file data to the storage engine
   * @param userId The ID of the owner
   * @param storedName Unique file name
   * @param buffer File binary buffer
   * @returns Local path, remote URL or storage key depending on provider
   */
  uploadFile(
    userId: string,
    storedName: string,
    fileData: Buffer | Readable
  ): Promise<{ path: string; key: string }>;

  /**
   * Downloads file data from the storage engine as a stream
   * @param path The physical path or unique key of the file
   * @param options Optional start and end byte offsets for partial content streaming
   */
  downloadFileStream(path: string, options?: { start?: number; end?: number }): Promise<Readable>;

  /**
   * Deletes physical file data from storage
   * @param path The physical path or unique key of the file
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Obtains serving URLs or signed access keys
   */
  getFileUrl(path: string): Promise<string>;
}
