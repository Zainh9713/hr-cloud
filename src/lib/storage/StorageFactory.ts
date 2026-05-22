import { IStorageProvider } from "./IStorageProvider";
import { LocalStorageProvider } from "./LocalStorageProvider";
import { S3StorageProvider } from "./S3StorageProvider";

export class StorageFactory {
  private static providerInstance: IStorageProvider;

  public static getProvider(): IStorageProvider {
    if (!StorageFactory.providerInstance) {
      const providerType = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
      
      switch (providerType) {
        case "s3":
        case "r2":
        case "supabase":
          StorageFactory.providerInstance = new S3StorageProvider();
          break;
        case "local":
        default:
          StorageFactory.providerInstance = new LocalStorageProvider();
          break;
      }
    }
    return StorageFactory.providerInstance;
  }
}
