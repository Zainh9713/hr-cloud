import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { FileService } from "@/services/FileService";
import connectDB from "@/lib/db";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId, versionNumber } = await request.json();
    if (!fileId || versionNumber === undefined) {
      return NextResponse.json({ error: "Missing fileId or versionNumber" }, { status: 400 });
    }

    await connectDB();
    const file = await FileService.restoreVersion(userId, fileId, parseInt(versionNumber, 10));

    return NextResponse.json({ success: true, file });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const versionNumberParam = searchParams.get("versionNumber");

    if (!fileId || !versionNumberParam) {
      return NextResponse.json({ error: "Missing fileId or versionNumber query parameter" }, { status: 400 });
    }

    const versionNumber = parseInt(versionNumberParam, 10);
    await connectDB();

    const file = await FileService.deleteVersion(userId, fileId, versionNumber);

    return NextResponse.json({ success: true, file });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
