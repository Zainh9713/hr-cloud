import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import connectDB from "@/lib/db";
import FileModel from "@/models/File";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Query active files for the user
    const files = await FileModel.find({
      ownerId: userId,
      isTrash: { $ne: true }
    }).sort({ createdAt: -1 });

    // Group files by MD5 hash
    const groups: Record<string, typeof files> = {};
    for (const file of files) {
      if (file.hash) {
        if (!groups[file.hash]) {
          groups[file.hash] = [];
        }
        groups[file.hash].push(file);
      }
    }

    // Filter to only hashes that have duplicates (more than 1 file)
    const duplicateGroups = Object.entries(groups)
      .filter(([_, groupFiles]) => groupFiles.length > 1)
      .map(([hash, groupFiles]) => {
        const size = groupFiles[0].size;
        const totalSize = size * groupFiles.length;
        const wastedSize = size * (groupFiles.length - 1);
        
        return {
          hash,
          size,
          totalSize,
          wastedSize,
          files: groupFiles
        };
      })
      .sort((a, b) => b.wastedSize - a.wastedSize); // Sort by most space wasted first

    return NextResponse.json({ duplicateGroups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
