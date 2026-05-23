"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { 
  FileIcon, 
  FolderIcon, 
  TrashIcon, 
  DownloadIcon, 
  MoreVerticalIcon, 
  Edit2Icon, 
  ChevronRightIcon, 
  HomeIcon, 
  SparklesIcon, 
  PlusIcon,
  StarIcon,
  PaletteIcon,
  CheckSquareIcon,
  XSquareIcon
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import FilePreviewModal from "./FilePreviewModal";
import { useFileStore } from "@/store/useFileStore";
import { useSocket } from "@/contexts/SocketContext";

const PRESET_COLORS = [
  { name: "Cyan", value: "#0ea5e9" },
  { name: "Magenta", value: "#d946ef" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Crimson", value: "#ef4444" }
];

function FileManagerContent({ 
  refreshTrigger, 
  onFolderChange 
}: { 
  refreshTrigger?: number;
  onFolderChange?: (folderId: string | null) => void;
}) {
  const {
    files,
    folders,
    currentFolderId,
    folderPath,
    loading,
    fetchData,
    createFolder,
    deleteItem,
    renameItem,
    moveItem,
    updateFolderMetadata,
    updateFileMetadata,
    syncFolderContext,
    hasMoreFiles,
    hasMoreFolders,
    fetchMoreFiles,
    fetchMoreFolders
  } = useFileStore();

  const { joinRoom, leaveRoom, presence } = useSocket();
  const roomName = `folder:${currentFolderId || "root"}`;
  const presenceUsers = presence[roomName] || [];

  const currentRoomRef = useRef<string | null>(null);

  useEffect(() => {
    const targetRoom = `folder:${currentFolderId || "root"}`;
    joinRoom(targetRoom);
    currentRoomRef.current = targetRoom;

    return () => {
      if (currentRoomRef.current) {
        leaveRoom(currentRoomRef.current);
      }
    };
  }, [currentFolderId]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const folderParam = pathname === "/dashboard/files" ? (searchParams.get("folder") || null) : null;

  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string, type: "file" | "folder", x: number, y: number } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverBreadcrumbId, setDragOverBreadcrumbId] = useState<string | null | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sorting State
  const [sortBy, setSortBy] = useState<"name" | "size" | "updatedAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const sync = async () => {
      await syncFolderContext(folderParam);
      await fetchData(folderParam);
      setSelectedIds([]); // Clear selection on folder navigate
      setFocusedIndex(-1);
    };
    sync();
  }, [folderParam, pathname, refreshTrigger, syncFolderContext, fetchData]);

  useEffect(() => {
    if (onFolderChange) {
      onFolderChange(currentFolderId);
    }
  }, [currentFolderId, onFolderChange]);

  const handleNavigate = (id: string | null) => {
    if (pathname === "/dashboard") {
      router.push(`/dashboard/files?folder=${id || ""}`);
    } else {
      if (id === null) {
        router.push("/dashboard/files");
      } else {
        router.push(`/dashboard/files?folder=${id}`);
      }
    }
  };

  // Click outside context menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, id: string, type: "file" | "folder") => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id, type, x: e.clientX, y: e.clientY });
  };

  const handleDelete = async (id: string, type: "file" | "folder") => {
    setContextMenu(null);
    if (!confirm(`Relocate this ${type} to the Recycler Bin?`)) return;
    try {
      await deleteItem(id, type);
      setSelectedIds(prev => prev.filter(x => x !== id));
    } catch (err) {}
  };

  const handleRename = async (id: string, type: "file" | "folder", currentName: string) => {
    setContextMenu(null);
    const newName = prompt(`Enter new identity name for ${type}:`, currentName);
    if (!newName || newName === currentName) return;
    try {
      await renameItem(id, type, newName);
    } catch (err) {}
  };

  const handleToggleStar = async (id: string, type: "file" | "folder", currentlyStarred: boolean) => {
    setContextMenu(null);
    try {
      if (type === "file") {
        await updateFileMetadata(id, { isStarred: !currentlyStarred });
      } else {
        await updateFolderMetadata(id, { isStarred: !currentlyStarred });
      }
      toast.success(currentlyStarred ? "Removed from favorites" : "Added to favorites");
    } catch (err) {}
  };

  const handleDownload = async (file: any) => {
    setContextMenu(null);
    try {
      const res = await fetch(`/api/files/download-token?fileId=${file._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(`/api/files/download?token=${data.token}`, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve download key");
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt("Enter new sector folder name:");
    if (!name) return;
    try {
      await createFolder(name, currentFolderId);
    } catch (err) {}
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string, type: "file" | "folder") => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify({ id, type }));
  };

  const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDragLeaveFolder = () => {
    setDragOverFolderId(null);
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    try {
      const dragDataStr = e.dataTransfer.getData("application/json");
      if (!dragDataStr) return;
      const { id, type } = JSON.parse(dragDataStr);
      if (id === targetFolderId) return;
      await moveItem(id, type, targetFolderId);
    } catch (err: any) {
      toast.error(err.message || "Failed to relocate asset");
    }
  };

  const handleDragOverBreadcrumb = (e: React.DragEvent, breadcrumbId: string | null) => {
    e.preventDefault();
    setDragOverBreadcrumbId(breadcrumbId);
  };

  const handleDragLeaveBreadcrumb = () => {
    setDragOverBreadcrumbId(undefined);
  };

  const handleDropOnBreadcrumb = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverBreadcrumbId(undefined);
    try {
      const dragDataStr = e.dataTransfer.getData("application/json");
      if (!dragDataStr) return;
      const { id, type } = JSON.parse(dragDataStr);
      if (id === targetFolderId) return;
      await moveItem(id, type, targetFolderId);
    } catch (err: any) {
      toast.error(err.message || "Failed to relocate asset");
    }
  };

  // Sorting logic
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortedFolders = [...folders].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === "updatedAt") {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    } else {
      cmp = a.name.localeCompare(b.name); // Size fallback for folders
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const sortedFiles = [...files].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = a.originalName.localeCompare(b.originalName);
    } else if (sortBy === "size") {
      cmp = a.size - b.size;
    } else if (sortBy === "updatedAt") {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const combinedItems = [
    ...sortedFolders.map(f => ({ ...f, itemType: "folder" as const })),
    ...sortedFiles.map(f => ({ ...f, itemType: "file" as const }))
  ].filter(item => {
    if (!searchQuery.trim()) return true;
    const name = item.itemType === "folder" ? item.name : item.originalName;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Selection handlers
  const handleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === combinedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(combinedItems.map(item => item._id));
    }
  };

  // Bulk actions handlers
  const handleBulkPurge = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Purge all ${selectedIds.length} selected assets to the Recycler Bin?`)) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const item = combinedItems.find(x => x._id === id);
      if (!item) continue;
      try {
        await deleteItem(id, item.itemType);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setSelectedIds([]);
    if (failCount > 0) {
      toast.error(`Purged ${successCount} assets. Failed to purge ${failCount} assets.`);
    } else {
      toast.success(`Successfully purged ${successCount} assets.`);
    }
  };

  // Keyboard navigation event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if focus is inside form input elements
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      if (combinedItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(combinedItems.length - 1, prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < combinedItems.length) {
          const item = combinedItems[focusedIndex];
          if (item.itemType === "folder") {
            handleNavigate(item._id);
          } else {
            setPreviewFile(item);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedIds([]);
        setFocusedIndex(-1);
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedIds(combinedItems.map(item => item._id));
        toast.success("Selected all grid assets");
      } else if (e.key === " ") {
        // Spacebar to toggle selection
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < combinedItems.length) {
          const item = combinedItems[focusedIndex];
          setSelectedIds(prev => 
            prev.includes(item._id) ? prev.filter(x => x !== item._id) : [...prev, item._id]
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, combinedItems]);

  return (
    <div className="space-y-4">
      
      {/* Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-primary/10 border border-primary/40 rounded-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquareIcon className="w-5 h-5 text-primary" />
            <span className="text-sm font-mono text-white font-bold">
              {selectedIds.length} ASSETS SELECTED
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkPurge}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-950/20 hover:bg-red-500/20 text-red-400 font-mono text-xs uppercase tracking-wider transition-all"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Bulk Purge
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-mono text-xs uppercase tracking-wider transition-all"
            >
              <XSquareIcon className="w-3.5 h-3.5" />
              Cancel Selection
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden relative">
        {/* Breadcrumb Navigation */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {folderPath.map((folder, index) => (
              <div 
                key={folder.id || 'root'} 
                className="flex items-center"
                onDragOver={(e) => handleDragOverBreadcrumb(e, folder.id)}
                onDragLeave={handleDragLeaveBreadcrumb}
                onDrop={(e) => handleDropOnBreadcrumb(e, folder.id)}
              >
                <button 
                  onClick={() => handleNavigate(folder.id)}
                  className={`flex items-center gap-1 font-mono text-sm transition-all duration-150 p-1 rounded hover:bg-white/5 ${
                    dragOverBreadcrumbId === folder.id ? "bg-primary/20 text-primary border border-primary/40 scale-105" : ""
                  } ${index === folderPath.length - 1 ? "text-white font-bold neon-text" : "text-gray-400 hover:text-white"}`}
                >
                  {folder.id === null ? <HomeIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}
                  {folder.name}
                </button>
                {index < folderPath.length - 1 && (
                  <ChevronRightIcon className="w-4 h-4 text-gray-600 mx-2 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {presenceUsers && presenceUsers.length > 0 && (
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {presenceUsers.map((u) => {
                  const initials = u.name
                    ? u.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                    : "??";
                  return (
                    <div
                      key={u.userId}
                      className="w-7 h-7 rounded-full bg-[#00ffcc] text-[#05050f] flex items-center justify-center text-[10px] font-mono font-bold border border-[#05050f] cursor-help shadow-[0_0_8px_rgba(0,255,204,0.4)]"
                      title={`${u.name} (${u.email}) is viewing this sector`}
                    >
                      {initials}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-primary/50 transition-all w-32 focus:w-48"
              />
            </div>

            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-gray-500 mr-2">
              <span>[▲/▼] Navigate</span>
              <span>[Space] Select</span>
              <span>[Enter] Open</span>
            </div>

            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30 transition-all font-mono text-xs font-bold uppercase tracking-wider"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New Sector
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading && combinedItems.length > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-primary animate-pulse font-mono z-10 bg-black/20 backdrop-blur-sm">SCANNING GRID...</div>
          ) : null}
          
          <table className="w-full text-left border-collapse relative">
            <thead>
              <tr className="text-xs font-mono text-gray-500 border-b border-white/10 bg-black/20 select-none">
                <th className="p-4 font-normal">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      checked={combinedItems.length > 0 && selectedIds.length === combinedItems.length}
                      onChange={handleSelectAll}
                      className="accent-primary cursor-pointer w-4 h-4 rounded border-white/20 bg-black/40 focus:ring-0 focus:ring-offset-0"
                    />
                    <button 
                      onClick={() => toggleSort("name")}
                      className="hover:text-white font-mono font-bold flex items-center gap-1 uppercase"
                    >
                      Name {sortBy === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                    </button>
                  </div>
                </th>
                <th className="p-4 font-normal">
                  <button 
                    onClick={() => toggleSort("size")}
                    className="hover:text-white font-mono font-bold flex items-center gap-1 uppercase"
                  >
                    Size {sortBy === "size" && (sortOrder === "asc" ? "▲" : "▼")}
                  </button>
                </th>
                <th className="p-4 font-normal">
                  <button 
                    onClick={() => toggleSort("updatedAt")}
                    className="hover:text-white font-mono font-bold flex items-center gap-1 uppercase"
                  >
                    Modified {sortBy === "updatedAt" && (sortOrder === "asc" ? "▲" : "▼")}
                  </button>
                </th>
                <th className="p-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {combinedItems.map((item, index) => {
                const isFolder = item.itemType === "folder";
                const isSelected = selectedIds.includes(item._id);
                const isFocused = index === focusedIndex;
                const isDragOver = dragOverFolderId === item._id;

                return (
                  <tr 
                    key={item._id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, item._id, item.itemType)}
                    onDragOver={(e) => isFolder ? handleDragOverFolder(e, item._id) : undefined}
                    onDragLeave={isFolder ? handleDragLeaveFolder : undefined}
                    onDrop={(e) => isFolder ? handleDropOnFolder(e, item._id) : undefined}
                    className={`border-b border-white/5 hover:bg-white/5 transition-all duration-150 group cursor-pointer ${
                      isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    } ${isFocused ? "bg-white/10 ring-1 ring-primary/45" : ""} ${
                      isDragOver ? "bg-primary/25 border-y-2 border-dashed border-primary" : ""
                    }`}
                    onClick={(e) => {
                      if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        handleSelectItem(item._id, e);
                      } else {
                        setFocusedIndex(index);
                        if (isFolder) {
                          handleNavigate(item._id);
                        } else {
                          setPreviewFile(item);
                        }
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, item._id, item.itemType)}
                  >
                    <td className="p-4 flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectItem(item._id, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-primary cursor-pointer w-4 h-4 rounded border-white/20 bg-black/40 focus:ring-0 focus:ring-offset-0"
                      />
                      
                      {isFolder ? (
                        <FolderIcon 
                          className="w-5 h-5 flex-shrink-0" 
                          style={{ 
                            color: item.color || "#0ea5e9",
                            filter: `drop-shadow(0 0 4px ${item.color || "#0ea5e9"}33)`
                          }} 
                        />
                      ) : (
                        <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium group-hover:text-primary transition-colors">
                          {isFolder ? item.name : item.originalName}
                        </span>
                        {item.isStarred && <StarIcon className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                      </div>
                    </td>
                    
                    <td className="p-4 text-sm text-gray-400 font-mono">
                      {isFolder ? "--" : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                    </td>
                    
                    <td className="p-4 text-sm text-gray-400 font-mono">
                      {format(new Date(item.updatedAt), "MMM dd, yyyy")}
                    </td>
                    
                    <td className="p-4 text-right space-x-2">
                      {!isFolder && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownload(item); }} 
                          className="text-gray-500 hover:text-secondary p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Download"
                        >
                          <DownloadIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, item._id, item.itemType); }} 
                        className="text-gray-500 hover:text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVerticalIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {loading && combinedItems.length === 0 && (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-white/5 bg-white/[0.01] hover:bg-white/[0.02]">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-4 h-4 rounded border border-white/10 bg-white/5 animate-pulse" />
                      <div className="w-5 h-5 rounded bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 animate-pulse shadow-[0_0_8px_rgba(0,255,204,0.1)]" />
                      <div className="h-4 bg-gradient-to-r from-white/5 to-white/15 rounded w-48 animate-pulse border border-white/5" />
                    </td>
                    <td className="p-4">
                      <div className="h-3.5 bg-white/5 rounded w-12 animate-pulse border border-white/5" />
                    </td>
                    <td className="p-4">
                      <div className="h-3.5 bg-white/5 rounded w-24 animate-pulse border border-white/5" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-block w-8 h-8 rounded bg-white/5 border border-white/10 animate-pulse" />
                    </td>
                  </tr>
                ))
              )}

              {combinedItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 font-mono">NO DATA FOUND IN CURRENT SECTOR</td>
                </tr>
              )}

              {(hasMoreFiles || hasMoreFolders) && (
                <tr>
                  <td colSpan={4} className="p-4 text-center">
                    <button
                      onClick={() => {
                        if (hasMoreFolders) fetchMoreFolders();
                        if (hasMoreFiles) fetchMoreFiles();
                      }}
                      className="px-6 py-2 rounded-lg bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30 font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      disabled={loading}
                    >
                      {loading ? "SCANNING SECTORS..." : "LOAD MORE ASSETS"}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={menuRef}
          className="fixed z-50 w-52 glass-panel border border-white/10 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-100 bg-[#070714]/90 backdrop-blur-md"
          style={{ 
            top: Math.min(contextMenu.y, window.innerHeight - 250), 
            left: Math.min(contextMenu.x, window.innerWidth - 220) 
          }}
        >
          <div className="py-1">
            <button 
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 font-mono"
              onClick={() => {
                if (contextMenu.type === "file") {
                  const item = files.find(f => f._id === contextMenu.id);
                  if (item) handleRename(contextMenu.id, "file", item.originalName);
                } else {
                  const item = folders.find(f => f._id === contextMenu.id);
                  if (item) handleRename(contextMenu.id, "folder", item.name);
                }
              }}
            >
              <Edit2Icon className="w-4 h-4 text-gray-400" /> Rename
            </button>

            <button 
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 font-mono"
              onClick={() => {
                const item = contextMenu.type === "file" 
                  ? files.find(f => f._id === contextMenu.id)
                  : folders.find(f => f._id === contextMenu.id);
                handleToggleStar(contextMenu.id, contextMenu.type, !!item?.isStarred);
              }}
            >
              <StarIcon className="w-4 h-4 text-gray-400" /> 
              {((contextMenu.type === "file" 
                ? files.find(f => f._id === contextMenu.id)
                : folders.find(f => f._id === contextMenu.id))?.isStarred) ? "Unfavorite" : "Favorite"}
            </button>
            
            {contextMenu.type === "file" && (
              <>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 font-mono"
                  onClick={async () => {
                    const fileId = contextMenu.id;
                    setContextMenu(null);
                    try {
                      const res = await fetch("/api/share", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fileId })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      
                      const url = `${window.location.origin}${data.link}`;
                      await navigator.clipboard.writeText(url);
                      toast.success("Secure link copied to clipboard!");
                    } catch (err: any) {
                      toast.error(err.message || "Failed to generate link");
                    }
                  }}
                >
                  <SparklesIcon className="w-4 h-4 text-primary" /> Share Link
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center gap-2 font-mono"
                  onClick={() => {
                    const file = files.find(f => f._id === contextMenu.id);
                    if (file) handleDownload(file);
                  }}
                >
                  <DownloadIcon className="w-4 h-4 text-secondary" /> Download
                </button>
              </>
            )}

            {contextMenu.type === "folder" && (
              <div className="px-4 py-2 text-[10px] font-mono text-gray-500 border-t border-white/5 mt-1">
                <span className="flex items-center gap-1 mb-1"><PaletteIcon className="w-3.5 h-3.5" /> COLOR CODE</span>
                <div className="flex gap-2 mt-1.5">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => {
                        updateFolderMetadata(contextMenu.id, { color: color.value });
                        setContextMenu(null);
                      }}
                      className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform"
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="h-px bg-white/10 my-1"></div>
            
            <button 
              className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-accent/10 flex items-center gap-2 font-mono"
              onClick={() => handleDelete(contextMenu.id, contextMenu.type)}
            >
              <TrashIcon className="w-4 h-4" /> Purge Sector
            </button>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

export default function FileManager(props: any) {
  return (
    <Suspense fallback={
      <div className="glass-panel rounded-2xl border border-white/10 p-8 flex items-center justify-center text-primary animate-pulse font-mono min-h-[400px]">
        SCANNING GRID...
      </div>
    }>
      <FileManagerContent {...props} />
    </Suspense>
  );
}
