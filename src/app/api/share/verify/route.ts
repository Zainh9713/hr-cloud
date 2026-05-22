import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDB from "@/lib/db";
import { ShareService } from "@/services/ShareService";

export async function POST(request: Request) {
  try {
    const { token, password, email } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    await connectDB();

    // Validate the share credentials
    const share = await ShareService.validateShareAccess(token, { password, email });

    // Set cookies for authentication persistence
    const cookieStore = await cookies();
    const oneDay = 24 * 60 * 60 * 1000;

    if (password) {
      cookieStore.set(`share_pass_${token}`, password, {
        maxAge: oneDay,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });
    }

    if (email) {
      cookieStore.set(`share_email_${token}`, email, {
        maxAge: oneDay,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });
    }

    // Update views counter for the initial verify view
    const ip = request.headers.get("x-forwarded-for") || null;
    const userAgent = request.headers.get("user-agent") || null;
    await ShareService.logAccess(share._id.toString(), "view", ip, userAgent);

    return NextResponse.json({
      success: true,
      role: share.role,
      shareType: share.shareType,
      targetType: share.fileId ? "file" : "folder",
      targetId: share.fileId || share.folderId
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
