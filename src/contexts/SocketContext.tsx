"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "react-hot-toast";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface PresenceUser {
  userId: string;
  name: string;
  email: string;
}

interface SocketContextType {
  socket: WebSocket | null;
  status: ConnectionStatus;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  presence: { [room: string]: PresenceUser[] };
  sendMessage: (action: string, payload: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [presence, setPresence] = useState<{ [room: string]: PresenceUser[] }>({});
  
  const activeRooms = useRef<Set<string>>(new Set());
  const lastEventTime = useRef<number>(Date.now());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);

  const connect = async () => {
    if (!isAuthenticated) return;
    
    setStatus("connecting");
    try {
      const res = await fetch("/api/auth/token");
      if (!res.ok) throw new Error("Failed to fetch WS auth token");
      const { token } = await res.json();

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Support customizable websocket host
      const wsHost = process.env.NEXT_PUBLIC_WS_URL || `${window.location.hostname}:3001`;
      const wsUrl = `${wsProtocol}//${wsHost}?token=${token}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      setSocket(ws);

      ws.onopen = () => {
        setStatus("connected");
        retryCount.current = 0;
        
        // Rejoin any previously active rooms and request missed events since lastEventTime
        activeRooms.current.forEach((room) => {
          ws.send(JSON.stringify({
            action: "join",
            room,
            since: lastEventTime.current
          }));
        });

        // Trigger recover for user-level events as well
        ws.send(JSON.stringify({
          action: "recover",
          since: lastEventTime.current
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          lastEventTime.current = Date.now();

          // Standard room presence update handling
          if (message.event === "presence_update") {
            const { room, users } = message.data;
            setPresence((prev) => ({ ...prev, [room]: users }));
          }

          // File system change handling
          if (message.event === "file_system_change") {
            // Auto refresh file store
            import("@/store/useFileStore").then((mod) => {
              mod.useFileStore.getState().fetchData();
            });
          }

          // Realtime notification handling
          if (message.event === "notification") {
            toast(message.data.message || "New alert received", {
              icon: "🔔",
              style: {
                background: "#0d0d25",
                color: "#00ffcc",
                border: "1px solid #00f3ff",
                fontFamily: "monospace"
              }
            });
            // Also refresh notifications count/list in UI if any
            window.dispatchEvent(new CustomEvent("refresh_notifications"));
          }

          // Realtime notification read status sync
          if (message.event === "notification_updated" || message.event === "all_notifications_read") {
            window.dispatchEvent(new CustomEvent("refresh_notifications"));
          }

          // Forward to general window listeners if anyone else wants to capture raw event
          window.dispatchEvent(new CustomEvent("ws_event", { detail: message }));

        } catch (err) {
          console.error("Error processing websocket message:", err);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        setSocket(null);
        socketRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        ws.close();
      };

    } catch (err) {
      console.error("Failed to setup WebSocket connection:", err);
      setStatus("disconnected");
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (!isAuthenticated) return;

    // Exponential backoff up to 30 seconds
    const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
    retryCount.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  };

  const joinRoom = (room: string) => {
    activeRooms.current.add(room);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        action: "join",
        room,
        since: lastEventTime.current
      }));
    }
  };

  const leaveRoom = (room: string) => {
    activeRooms.current.delete(room);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        action: "leave",
        room
      }));
    }
    setPresence((prev) => {
      const next = { ...prev };
      delete next[room];
      return next;
    });
  };

  const sendMessage = (action: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...payload }));
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      if (socketRef.current) socketRef.current.close();
      setStatus("disconnected");
      setSocket(null);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, status, joinRoom, leaveRoom, presence, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
