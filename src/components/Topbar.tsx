"use client";
import { BellIcon, SearchIcon, UserCircleIcon, LogOutIcon, SparklesIcon, FileIcon, FolderIcon, Loader2Icon, MenuIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";

export default function Topbar({ user, onToggleSidebar }: { user?: { name: string, email: string }, onToggleSidebar?: () => void }) {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{files: any[], folders: any[]}>({ files: [], folders: [] });
  const [isSearchingAPI, setIsSearchingAPI] = useState(false);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error("Notifications fetch failed", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const handleRefresh = () => fetchNotifications();
    window.addEventListener("refresh_notifications", handleRefresh);

    const handleWSEvent = (e: Event) => {
      const message = (e as CustomEvent).detail;
      if (message.event === "notification") {
        const newNotif = message.data;
        setNotifications(prev => [newNotif, ...prev]);
      }
    };
    window.addEventListener("ws_event", handleWSEvent);

    return () => {
      window.removeEventListener("refresh_notifications", handleRefresh);
      window.removeEventListener("ws_event", handleWSEvent);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults({ files: [], folders: [] });
      setIsSearchingAPI(false);
      return;
    }

    setIsSearchingAPI(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&semantic=true`);
        const data = await res.json();
        setSearchResults({ files: data.files || [], folders: data.folders || [] });
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearchingAPI(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleSearchResultDownload = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/download-token?fileId=${fileId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(`/api/files/download?token=${data.token}`, "_blank");
    } catch (err: any) {
      console.error("Failed to retrieve download token:", err);
    }
  };


  return (
    <header className="h-20 glass-panel border-b border-white/10 px-8 flex items-center justify-between sticky top-0 z-30 w-full gap-4">
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all flex-shrink-0"
          aria-label="Toggle Navigation Sidebar"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
      )}
      <div className="flex-1 max-w-xl relative group" ref={searchRef}>
        <div className={`absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-0 group-hover:opacity-30 transition duration-1000 ${isSearching ? 'opacity-50' : ''}`}></div>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="AI Semantic Search (e.g. 'receipts from last week')" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-[#05050f]/80 backdrop-blur-sm border border-white/10 rounded-full py-2.5 pl-12 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono text-sm"
          />
          {isSearchingAPI ? (
            <Loader2Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
          ) : (
            <SparklesIcon className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary transition-opacity ${isSearching ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isSearching && searchQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-primary/30 rounded-xl shadow-[0_0_30px_rgba(139,92,246,0.15)] overflow-hidden z-50">
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {searchResults.folders.length > 0 && (
                <div className="p-2 border-b border-white/5">
                  <h4 className="text-xs font-mono text-gray-500 px-3 pb-1 uppercase tracking-wider">Folders</h4>
                  {searchResults.folders.map(folder => (
                    <div key={folder._id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/files?folder=${folder._id}`)}>
                      <FolderIcon className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span className="text-sm text-gray-200 truncate">{folder.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.files.length > 0 && (
                <div className="p-2">
                  <h4 className="text-xs font-mono text-gray-500 px-3 pb-1 uppercase tracking-wider">Files</h4>
                  {searchResults.files.map(file => (
                    <div key={file._id} className="flex flex-col px-3 py-2 hover:bg-white/10 rounded cursor-pointer transition-colors" onClick={() => handleSearchResultDownload(file._id)}>
                      <div className="flex items-center gap-3">
                        <FileIcon className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-gray-200 truncate">{file.originalName}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono ml-7 mt-0.5">{(file.size / 1024).toFixed(1)} KB • {format(new Date(file.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  ))}
                </div>
              )}
              {!isSearchingAPI && searchResults.folders.length === 0 && searchResults.files.length === 0 && (
                <div className="p-8 text-center text-gray-500 font-mono text-sm">
                  NO SECURE DATABANKS FOUND
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-gray-400 hover:text-primary transition-colors p-1"
            title="System Diagnostics & Alerts"
          >
            <BellIcon className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_#f43f5e]"></span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-4 w-80 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_0_35px_rgba(34,211,238,0.2)] overflow-hidden z-50">
              <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <h3 className="text-xs font-mono font-bold text-white tracking-widest uppercase">SYSTEM NOTIFICATIONS</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-mono text-primary hover:text-white uppercase transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs font-mono text-gray-500">
                    NO ACTIVE ALERTS
                  </div>
                ) : (
                  notifications.map((notif) => {
                    let colorClass = "text-cyan-400 border-cyan-400/20";
                    let icon = <BellIcon className="w-4 h-4 text-cyan-400" />;
                    if (notif.type === "upload_complete") {
                      colorClass = "text-emerald-400 border-emerald-400/20";
                      icon = <FileIcon className="w-4 h-4 text-emerald-400" />;
                    } else if (notif.type === "ai_analysis" || notif.type === "ocr_complete") {
                      colorClass = "text-purple-400 border-purple-400/20";
                      icon = <SparklesIcon className="w-4 h-4 text-purple-400" />;
                    } else if (notif.type === "upload_failed") {
                      colorClass = "text-red-400 border-red-400/20";
                      icon = <BellIcon className="w-4 h-4 text-red-400" />;
                    } else if (notif.type === "share_invite") {
                      colorClass = "text-amber-400 border-amber-400/20";
                      icon = <UserCircleIcon className="w-4 h-4 text-amber-400" />;
                    }

                    return (
                      <div 
                        key={notif._id || Math.random().toString()} 
                        onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                        className={`p-3.5 hover:bg-white/5 transition-colors cursor-pointer flex gap-3 relative ${
                          !notif.isRead ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        {!notif.isRead && (
                          <div className="absolute top-1/2 -translate-y-1/2 left-1.5 w-1 h-8 bg-gradient-to-b from-primary to-secondary rounded"></div>
                        )}
                        <div className="flex-shrink-0 mt-0.5">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold font-mono truncate ${colorClass}`}>{notif.title}</p>
                          <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">{notif.message}</p>
                          <span className="text-[9px] font-mono text-gray-500 block mt-1">
                            {format(new Date(notif.createdAt), "yyyy-MM-dd HH:mm")}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 border-l border-white/10 pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white">{user?.name || "Cyber User"}</p>
            <p className="text-xs text-primary font-mono">{user?.email || "SYS_ADMIN"}</p>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-accent transition-colors ml-2" title="Log Out">
            <LogOutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
