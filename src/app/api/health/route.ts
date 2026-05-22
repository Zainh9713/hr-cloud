import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import fsPromises from "fs/promises";
import path from "path";

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = "disconnected";
  let dbError: string | null = null;
  
  // 1. Check Database connection
  try {
    await connectDB();
    const state = mongoose.connection.readyState;
    if (state === 1) {
      dbStatus = "connected";
    } else if (state === 2) {
      dbStatus = "connecting";
    } else {
      dbStatus = "disconnected";
    }
  } catch (err: any) {
    dbStatus = "error";
    dbError = err.message || "Failed to connect to database";
  }

  // 2. Check Storage write availability
  let storageStatus = "unknown";
  let storageError: string | null = null;
  const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");
  const tempCheckPath = path.join(storageRoot, ".healthcheck-temp.txt");

  try {
    await fsPromises.mkdir(storageRoot, { recursive: true });
    
    // Attempt write
    await fsPromises.writeFile(tempCheckPath, `healthcheck-${timestamp}`, "utf-8");
    
    // Attempt read
    const content = await fsPromises.readFile(tempCheckPath, "utf-8");
    
    // Attempt delete
    await fsPromises.unlink(tempCheckPath);
    
    if (content === `healthcheck-${timestamp}`) {
      storageStatus = "writable";
    } else {
      storageStatus = "integrity_mismatch";
    }
  } catch (err: any) {
    storageStatus = "error";
    storageError = err.message || "Disk/Storage access failure";
  }

  // 3. Verify Configurations (presence check only)
  const config = {
    hasMongoUri: !!process.env.MONGODB_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasWsUrl: !!process.env.NEXT_PUBLIC_WS_URL,
    environment: process.env.NODE_ENV || "development",
  };

  const isHealthy = dbStatus === "connected" && storageStatus === "writable";
  
  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp,
      services: {
        database: {
          status: dbStatus,
          error: dbError,
        },
        storage: {
          status: storageStatus,
          root: storageRoot,
          error: storageError,
        },
        config,
      },
    },
    { status: isHealthy ? 200 : 500 }
  );
}
