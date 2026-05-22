import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "./jwt";
import { logger } from "./logger";
import { IncomingMessage } from "http";
import connectDB from "./db";

// Initialize global storage maps for hot-reload preservation in development
if (!(global as any).userSockets) {
  (global as any).userSockets = new Map<string, WebSocket[]>();
}
if (!(global as any).roomMembers) {
  (global as any).roomMembers = new Map<string, Set<WebSocket>>();
}
if (!(global as any).eventBuffer) {
  (global as any).eventBuffer = [];
}

const userSockets = (global as any).userSockets as Map<string, WebSocket[]>;
const roomMembers = (global as any).roomMembers as Map<string, Set<WebSocket>>;
const eventBuffer = (global as any).eventBuffer as Array<{
  id: string;
  userId?: string;
  room?: string;
  event: string;
  data: any;
  timestamp: number;
}>;

export class WebSocketService {
  /**
   * Log event to the sliding replay buffer
   */
  private static logEvent(event: string, data: any, userId?: string, room?: string) {
    const eventId = Math.random().toString(36).substring(7);
    eventBuffer.push({
      id: eventId,
      userId,
      room,
      event,
      data,
      timestamp: Date.now()
    });
    // Cap buffer size at 200 events
    if (eventBuffer.length > 200) {
      eventBuffer.shift();
    }
  }

  /**
   * Sends an event to all open connections associated with a specific user.
   */
  public static sendToUser(userId: string, event: string, data: any): void {
    this.logEvent(event, data, userId);

    const activeSockets = userSockets.get(userId);
    if (!activeSockets || activeSockets.length === 0) {
      return;
    }

    const payload = JSON.stringify({ event, data });
    const stillActive: WebSocket[] = [];

    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        stillActive.push(ws);
      }
    }

    if (stillActive.length !== activeSockets.length) {
      if (stillActive.length === 0) {
        userSockets.delete(userId);
      } else {
        userSockets.set(userId, stillActive);
      }
    }
  }

  /**
   * Broadcasts an event to every active connection globally.
   */
  public static broadcast(event: string, data: any): void {
    this.logEvent(event, data);

    const payload = JSON.stringify({ event, data });
    userSockets.forEach((sockets, userId) => {
      const stillActive = sockets.filter(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
          return true;
        }
        return false;
      });

      if (stillActive.length === 0) {
        userSockets.delete(userId);
      } else {
        userSockets.set(userId, stillActive);
      }
    });
  }

  /**
   * Broadcasts an event to all users subscribed to a specific room.
   */
  public static broadcastToRoom(room: string, event: string, data: any): void {
    this.logEvent(event, data, undefined, room);

    const members = roomMembers.get(room);
    if (!members) return;

    const payload = JSON.stringify({ event, data });
    const stillActive: WebSocket[] = [];

    for (const ws of members) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        stillActive.push(ws);
      }
    }

    roomMembers.set(room, new Set(stillActive));
  }

  /**
   * Sends presence updates to everyone inside a specific room.
   */
  public static sendPresenceUpdate(room: string): void {
    const members = roomMembers.get(room);
    if (!members) return;

    const userMap = new Map<string, { userId: string; name: string; email: string }>();
    for (const ws of members) {
      if (ws.readyState === WebSocket.OPEN) {
        const anyWs = ws as any;
        if (anyWs.userId) {
          userMap.set(anyWs.userId, {
            userId: anyWs.userId,
            name: anyWs.userName || "Anonymous",
            email: anyWs.userEmail || "unknown"
          });
        }
      }
    }

    const presenceList = Array.from(userMap.values());
    this.broadcastToRoom(room, "presence_update", { room, users: presenceList });
  }

  /**
   * Cluster-aware publish method. Broadcasts events locally and is ready to hook into Redis pub/sub.
   */
  public static publish(userId: string, event: string, data: any): void {
    // Future Redis integration point:
    // redisPubClient.publish('cluster-events', JSON.stringify({ userId, event, data }));
    
    // Current single-process implementation:
    this.sendToUser(userId, event, data);
  }
}

/**
 * Initializes the WebSocket server on port 3001.
 */
export function initWebSocketServer(): void {
  if ((global as any).wss) {
    logger.info("WebSocket server already running (cached).");
    return;
  }

  try {
    const port = process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 3001;
    logger.info(`Attempting to boot WebSocket server on port ${port}...`);

    const wss = new WebSocketServer({ port });
    (global as any).wss = wss;

    wss.on("error", (serverErr: any) => {
      logger.error(`WebSocket Server Error on port ${port}:`, serverErr);
    });

    logger.info(`WebSocket Server booted successfully on port ${port}.`);

    // Setup periodic ping timer to check for inactive clients
    if (!(global as any).pingInterval) {
      (global as any).pingInterval = setInterval(() => {
        const server = (global as any).wss as WebSocketServer;
        if (!server) return;
        server.clients.forEach((ws: WebSocket) => {
          const anyWs = ws as any;
          if (anyWs.isAlive === false) {
            logger.info(`WebSocket inactive client terminated: user=${anyWs.userId}`);
            return ws.terminate();
          }
          anyWs.isAlive = false;
          ws.ping();
        });
      }, 30000);
    }

    wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      try {
        const url = req.url || "";
        const { searchParams } = new URL(url, "http://localhost:3001");
        const token = searchParams.get("token");

        if (!token) {
          logger.warn("WebSocket client connection rejected: token missing.");
          ws.close(4001, "Unauthorized: Token Required");
          return;
        }

        const decoded = verifyToken(token) as { id: string } | null;
        if (!decoded || !decoded.id) {
          logger.warn("WebSocket client connection rejected: invalid token.");
          ws.close(4002, "Unauthorized: Invalid Token");
          return;
        }

        const userId = decoded.id;
        
        // Fetch user data from database for presence updates
        await connectDB();
        const User = (await import("@/models/User")).default;
        const user = await User.findById(userId);
        
        const anyWs = ws as any;
        anyWs.userId = userId;
        anyWs.userName = user ? user.name : "Anonymous";
        anyWs.userEmail = user ? user.email : "unknown";
        anyWs.isAlive = true;

        const sockets = userSockets.get(userId) || [];
        sockets.push(ws);
        userSockets.set(userId, sockets);

        const socketRooms = new Set<string>();

        logger.info(`WebSocket client connected: user=${userId}. Total connections=${sockets.length}`);

        ws.on("pong", () => {
          anyWs.isAlive = true;
        });

        ws.on("message", (messageData: string) => {
          try {
            const parsed = JSON.parse(messageData);
            
            if (parsed.action === "join") {
              const room = parsed.room;
              if (room) {
                if (!roomMembers.has(room)) {
                  roomMembers.set(room, new Set());
                }
                roomMembers.get(room)!.add(ws);
                socketRooms.add(room);
                logger.info(`WebSocket user=${userId} joined room=${room}`);
                
                WebSocketService.sendPresenceUpdate(room);

                // Recover past events inside this room if since is provided
                const since = parsed.since;
                if (since && !isNaN(parseInt(since, 10))) {
                  const sinceTs = parseInt(since, 10);
                  const missed = eventBuffer.filter(e => e.room === room && e.timestamp > sinceTs);
                  for (const e of missed) {
                    ws.send(JSON.stringify({ event: e.event, data: e.data, replayed: true }));
                  }
                }
              }
            } else if (parsed.action === "leave") {
              const room = parsed.room;
              if (room) {
                if (roomMembers.has(room)) {
                  roomMembers.get(room)!.delete(ws);
                }
                socketRooms.delete(room);
                logger.info(`WebSocket user=${userId} left room=${room}`);
                
                WebSocketService.sendPresenceUpdate(room);
              }
            } else if (parsed.action === "recover") {
              const since = parsed.since;
              if (since && !isNaN(parseInt(since, 10))) {
                const sinceTs = parseInt(since, 10);
                const missed = eventBuffer.filter(e => e.userId === userId && e.timestamp > sinceTs);
                for (const e of missed) {
                  ws.send(JSON.stringify({ event: e.event, data: e.data, replayed: true }));
                }
              }
            }
          } catch (err) {
            logger.error("Error processing client WebSocket message:", err);
          }
        });

        ws.on("close", () => {
          // Leave all rooms
          for (const room of socketRooms) {
            if (roomMembers.has(room)) {
              roomMembers.get(room)!.delete(ws);
              WebSocketService.sendPresenceUpdate(room);
            }
          }

          const uSocks = userSockets.get(userId) || [];
          const remaining = uSocks.filter(s => s !== ws);
          
          if (remaining.length === 0) {
            userSockets.delete(userId);
          } else {
            userSockets.set(userId, remaining);
          }
          logger.info(`WebSocket client disconnected: user=${userId}`);
        });

        ws.on("error", (err) => {
          logger.error(`WebSocket connection error on user=${userId}:`, err);
        });

      } catch (connErr) {
        logger.error("Error occurred while processing WebSocket client connection:", connErr);
        ws.close(1011, "Internal Server Error");
      }
    });

    wss.on("error", (serverErr) => {
      logger.error("Global WebSocket Server Error:", serverErr);
    });

  } catch (err: any) {
    logger.error(`Failed to start WebSocket server: ${err.message}`);
  }
}
