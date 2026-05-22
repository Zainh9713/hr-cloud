import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import StorageStats from "@/models/StorageStats";
import mongoose from "mongoose";

export class StorageService {
  public static async getStorageUsage(userId: string) {
    await connectDB();

    // Calculate real usage using MongoDB aggregation pipeline
    const result = await FileModel.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(userId),
          isTrash: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$size" },
          images: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "^image/" } },
                "$size",
                0
              ]
            }
          },
          videos: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "^video/" } },
                "$size",
                0
              ]
            }
          },
          documents: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "pdf" } },
                    { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "document" } },
                    { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "text" } },
                    { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "msword" } },
                    { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "sheet" } },
                    { $regexMatch: { input: { $toLower: "$mimeType" }, regex: "presentation" } }
                  ]
                },
                "$size",
                0
              ]
            }
          }
        }
      }
    ]);

    const statsResult = result[0] || {
      totalSize: 0,
      images: 0,
      videos: 0,
      documents: 0
    };

    const usedStorage = statsResult.totalSize;
    const images = statsResult.images;
    const videos = statsResult.videos;
    const documents = statsResult.documents;
    const others = Math.max(0, usedStorage - (images + videos + documents));

    let stats = await StorageStats.findOne({ userId });
    const defaultLimit = 5 * 1024 * 1024 * 1024; // 5GB default limit

    if (stats) {
      stats.usedStorage = usedStorage;
      stats.lastCalculated = new Date();
      await stats.save();
    } else {
      stats = await StorageStats.create({
        userId,
        totalLimit: defaultLimit,
        usedStorage: usedStorage,
        lastCalculated: new Date()
      });
    }

    return {
      totalStorage: stats.totalLimit,
      usedStorage,
      freeStorage: Math.max(0, stats.totalLimit - usedStorage),
      usageByType: {
        images,
        videos,
        documents,
        others
      }
    };
  }

  public static async hasSpaceFor(userId: string, sizeBytes: number): Promise<boolean> {
    await connectDB();
    const stats = await StorageStats.findOne({ userId });
    const limit = stats ? stats.totalLimit : 5 * 1024 * 1024 * 1024;

    const result = await FileModel.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(userId),
          isTrash: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$size" }
        }
      }
    ]);

    const usedStorage = result[0]?.totalSize || 0;

    return usedStorage + sizeBytes <= limit;
  }
}
