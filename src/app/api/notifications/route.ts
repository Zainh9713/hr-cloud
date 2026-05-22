import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { NotificationService } from "@/services/NotificationService";

/**
 * GET: Retrieve notifications for the current user.
 * Optional query parameters:
 *  - onlyUnread: "true" to only retrieve unread notifications
 *  - limit: number of records (default: 50)
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const onlyUnread = searchParams.get("onlyUnread") === "true";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const notifications = await NotificationService.getUserNotifications(userId, limit, onlyUnread);
    return NextResponse.json({ notifications }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH: Mark a specific notification or all notifications as read.
 * Request Body options:
 *  - id: string (marks single notification as read)
 *  - all: boolean (if true, marks all user's notifications as read)
 */
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const userId = await AuthService.getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, all } = body;

    if (all) {
      const modifiedCount = await NotificationService.markAllAsRead(userId);
      return NextResponse.json({ success: true, modifiedCount }, { status: 200 });
    }

    if (!id) {
      return NextResponse.json({ error: "Notification ID or 'all' flag required" }, { status: 400 });
    }

    const notification = await NotificationService.markAsRead(userId, id);
    if (!notification) {
      return NextResponse.json({ error: "Notification not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, notification }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
