import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import SearchHistory from "@/models/SearchHistory";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token) as { id: string } | null;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    // Fetch the 15 most recent search queries for autocomplete
    const history = await SearchHistory.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(100);

    // Get unique queries, keeping the most recent order
    const uniqueQueries: string[] = [];
    const seen = new Set<string>();
    for (const h of history) {
      const q = h.query.trim();
      if (!seen.has(q)) {
        seen.add(q);
        uniqueQueries.push(q);
      }
      if (uniqueQueries.length >= 10) break;
    }

    return NextResponse.json({ history: uniqueQueries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    await SearchHistory.deleteMany({ userId: user.id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
