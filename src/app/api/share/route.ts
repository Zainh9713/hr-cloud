import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import connectDB from "@/lib/db";
import { ShareService } from "@/services/ShareService";
import SharedLink from "@/models/SharedLink";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token) as { id: string } | null;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const folderId = searchParams.get("folderId");

    await connectDB();

    let query: any = { ownerId: user.id, isRevoked: false };
    if (fileId) query.fileId = fileId;
    if (folderId) query.folderId = folderId;

    const shares = await SharedLink.find(query)
      .populate("fileId", "originalName size mimeType")
      .populate("folderId", "name");

    return NextResponse.json({ shares });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      fileId,
      folderId,
      shareType,
      sharedWithEmail,
      role,
      password,
      expiresInDays
    } = await request.json();

    const targetId = fileId || folderId;
    const targetType = fileId ? "file" : "folder";

    if (!targetId) {
      return NextResponse.json({ error: "File ID or Folder ID is required" }, { status: 400 });
    }

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const share = await ShareService.createShare(user.id, targetId, targetType, {
      shareType,
      sharedWithEmail,
      role,
      password,
      expiresAt
    });

    return NextResponse.json({
      success: true,
      link: `/share/${share.token}`,
      share
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id"); // SharedLink ID

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await ShareService.revokeShare(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
