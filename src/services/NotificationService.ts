import Notification, { INotification } from "@/models/Notification";
import { WebSocketService } from "@/lib/socket";
import connectDB from "@/lib/db";
import mongoose from "mongoose";

export class NotificationService {
  /**
   * Creates a notification in the database and broadcasts it via WebSocket.
   */
  public static async createNotification(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    type: "upload_complete" | "ai_analysis" | "share_invite" | "storage_warning" | "upload_failed" | "ocr_complete" | "info" = "info"
  ): Promise<INotification> {
    await connectDB();
    
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      isRead: false,
    });

    // Send realtime event through WebSocket
    try {
      WebSocketService.publish(userId.toString(), "notification", {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    } catch (wsErr) {
      console.error("Failed to publish notification via WebSocket:", wsErr);
    }

    return notification;
  }

  /**
   * Retrieves notifications for a given user, sorted by newest first.
   */
  public static async getUserNotifications(
    userId: string,
    limit = 50,
    onlyUnread = false
  ): Promise<INotification[]> {
    await connectDB();
    
    const query: any = { userId };
    if (onlyUnread) {
      query.isRead = false;
    }

    return Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Marks a specific notification as read.
   */
  public static async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<INotification | null> {
    await connectDB();
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (notification) {
      // Notify the user client of the updated notification status
      try {
        WebSocketService.publish(userId, "notification_updated", {
          id: notification._id,
          isRead: notification.isRead,
        });
      } catch (wsErr) {
        console.error("Failed to publish notification update via WebSocket:", wsErr);
      }
    }

    return notification;
  }

  /**
   * Marks all notifications of a user as read.
   */
  public static async markAllAsRead(userId: string): Promise<number> {
    await connectDB();
    
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    // Notify user client of all read
    try {
      WebSocketService.publish(userId, "all_notifications_read", {});
    } catch (wsErr) {
      console.error("Failed to publish all notifications read via WebSocket:", wsErr);
    }

    return result.modifiedCount;
  }
}
