
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";
import Folder from "@/models/Folder";
import SearchHistory from "@/models/SearchHistory";
import { AIProviderFactory } from "@/lib/ai/AIProviderFactory";
import { VectorStoreFactory } from "@/lib/ai/VectorStore";
import { logger } from "@/lib/logger";
import mongoose from "mongoose";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token) as { id: string } | null;
}

const suggestionCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const mimeType = searchParams.get("mimeType");
    const sizeMin = searchParams.get("sizeMin");
    const sizeMax = searchParams.get("sizeMax");
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");
    const isStarred = searchParams.get("isStarred");
    const tag = searchParams.get("tag");
    const semantic = searchParams.get("semantic");
    const suggest = searchParams.get("suggest");
    
    const pageStr = searchParams.get("page");
    const limitStr = searchParams.get("limit");
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 30;

    await connectDB();

    // 1. Suggestion mode
    if (suggest === "true") {
      if (!q || !q.trim()) {
        return NextResponse.json({ suggestions: [] });
      }
      const cacheKey = `${user.id}:${q.trim().toLowerCase()}`;
      const cached = suggestionCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return NextResponse.json({ suggestions: cached.data });
      }

      const queryRegex = new RegExp(q.trim(), "i");
      const [matchedFiles, matchedFolders] = await Promise.all([
        FileModel.find({ ownerId: user.id, originalName: queryRegex, isTrash: { $ne: true } }).limit(5).select("originalName"),
        Folder.find({ ownerId: user.id, name: queryRegex, isTrash: { $ne: true } }).limit(5).select("name")
      ]);

      const suggestions = [
        ...matchedFiles.map(f => ({ text: f.originalName, type: "file" })),
        ...matchedFolders.map(f => ({ text: f.name, type: "folder" }))
      ];

      suggestionCache.set(cacheKey, { data: suggestions, expiry: Date.now() + CACHE_TTL_MS });
      return NextResponse.json({ suggestions });
    }

    // 2. Log query to SearchHistory
    if (q && q.trim()) {
      SearchHistory.create({ userId: user.id, query: q.trim() }).catch(err => {
        logger.error("Failed to write search history:", err);
      });
    }

    // 3. AI Semantic Query Parsing
    let parsed: any = null;
    if (q && q.trim() && semantic === "true") {
      try {
        const provider = AIProviderFactory.getProvider();
        parsed = await provider.parseSemanticQuery(q);
        logger.info("AI parsed query into structural filters:", parsed);
      } catch (err) {
        logger.error("AI Semantic Query parsing failed, using standard query instead:", err);
      }
    }

    // 4. Construct MongoDB Queries
    const fileQuery: any = { ownerId: user.id, isTrash: { $ne: true } };
    const folderQuery: any = { ownerId: user.id, isTrash: { $ne: true } };

    // Apply main query or keywords
    if (q && q.trim()) {
      const searchTerms = parsed?.keywords && parsed.keywords.length > 0 ? parsed.keywords : [q.trim()];
      const searchRegexes = searchTerms.map((t: string) => new RegExp(t, "i"));
      
      fileQuery.$or = [
        ...searchRegexes.map((r: RegExp) => ({ originalName: r })),
        ...searchRegexes.map((r: RegExp) => ({ mimeType: r })),
        ...searchRegexes.map((r: RegExp) => ({ tags: r })),
        ...searchRegexes.map((r: RegExp) => ({ aiSummary: r }))
      ];

      folderQuery.name = new RegExp(q.trim(), "i");
    }

    // Faceted constraints (override parsed semantic queries if explicitly supplied)
    const targetMime = mimeType || parsed?.filters?.mimeType;
    if (targetMime) {
      fileQuery.mimeType = new RegExp(targetMime, "i");
    }

    const sMin = sizeMin ? parseInt(sizeMin, 10) : parsed?.filters?.sizeMin;
    const sMax = sizeMax ? parseInt(sizeMax, 10) : parsed?.filters?.sizeMax;
    if (sMin !== undefined || sMax !== undefined) {
      fileQuery.size = {};
      if (sMin !== undefined) fileQuery.size.$gte = sMin;
      if (sMax !== undefined) fileQuery.size.$lte = sMax;
    }

    const dMin = dateMin ? new Date(dateMin) : (parsed?.filters?.dateMin ? new Date(parsed.filters.dateMin) : null);
    const dMax = dateMax ? new Date(dateMax) : (parsed?.filters?.dateMax ? new Date(parsed.filters.dateMax) : null);
    if (dMin || dMax) {
      fileQuery.createdAt = {};
      if (dMin) fileQuery.createdAt.$gte = dMin;
      if (dMax) fileQuery.createdAt.$lte = dMax;
    }

    const starredVal = isStarred === "true" ? true : (isStarred === "false" ? false : parsed?.filters?.isStarred);
    if (starredVal !== undefined) {
      fileQuery.isStarred = starredVal;
    }

    const targetTag = tag || (parsed?.filters?.tags && parsed.filters.tags[0]);
    if (targetTag) {
      fileQuery.tags = targetTag;
    }

    // 5. Perform Hybrid Vector Similarity Search
    let vectorResults: any[] = [];
    if (q && q.trim() && semantic === "true") {
      try {
        const provider = AIProviderFactory.getProvider();
        const store = VectorStoreFactory.getStore();
        
        logger.info(`Performing vector semantic similarity search for: "${q}"`);
        const queryEmbedding = await provider.generateEmbedding(q);
        const similar = await store.searchSimilar(user.id, queryEmbedding, 15);
        
        if (similar.length > 0) {
          const fileIds = similar.map(s => new mongoose.Types.ObjectId(s.fileId));
          const matchedFiles = await FileModel.find({
            _id: { $in: fileIds },
            ownerId: user.id,
            isTrash: { $ne: true }
          });
          
          const scoreMap = new Map(similar.map(s => [s.fileId, s.score]));
          matchedFiles.sort((a, b) => (scoreMap.get(b._id.toString()) || 0) - (scoreMap.get(a._id.toString()) || 0));
          vectorResults = matchedFiles;
        }
      } catch (vectorErr) {
        logger.error("Semantic vector search pipeline failed:", vectorErr);
      }
    }

    // 6. Standard Database Queries Execution
    const [files, folders, totalFiles, totalFolders] = await Promise.all([
      FileModel.find(fileQuery).sort({ createdAt: -1 }),
      Folder.find(folderQuery).sort({ createdAt: -1 }),
      FileModel.countDocuments(fileQuery),
      Folder.countDocuments(folderQuery)
    ]);

    // 7. Merge Vector and Keyword Results (deduplicated)
    let finalFiles = files;
    if (vectorResults.length > 0) {
      const seenIds = new Set(vectorResults.map(f => f._id.toString()));
      const filteredStandardFiles = files.filter(f => !seenIds.has(f._id.toString()));
      finalFiles = [...vectorResults, ...filteredStandardFiles];
    }

    // 8. Slicing with pagination bounds
    const skip = (page - 1) * limit;
    const paginatedFiles = finalFiles.slice(skip, skip + limit);
    const paginatedFolders = folders.slice(skip, skip + limit);

    return NextResponse.json({
      files: paginatedFiles,
      folders: paginatedFolders,
      totalFiles,
      totalFolders,
      page,
      limit
    });
  } catch (error: any) {
    logger.error("Search API endpoint failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
