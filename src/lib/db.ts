import mongoose from "mongoose";
import { initWebSocketServer } from "./socket";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn("Please define the MONGODB_URI environment variable inside .env.local");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

// Prevent "Collection namespace is already in use" by disabling Mongoose autoCreate 
// in serverless/HMR environments. Collections will still be created implicitly by MongoDB 
// upon first document insertion.
mongoose.set("autoCreate", false);


async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: process.env.NODE_ENV === "production" ? 50 : 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
      // Validate Database in Production
      if (process.env.NODE_ENV === "production") {
        try {
          await mongoose.connection.db?.command({ ping: 1 });
          console.log("✅ MongoDB Atlas connection pinged successfully.");
        } catch (dbErr) {
          console.error("❌ MongoDB Atlas validation failed:", dbErr);
        }
      }

      // Auto-boot WebSocket Server
      try {
        initWebSocketServer();
      } catch (wsErr) {
        console.error("Failed to auto-boot WebSocket Server:", wsErr);
      }
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
