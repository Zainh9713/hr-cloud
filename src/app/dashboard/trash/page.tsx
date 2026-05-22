"use client";
import { useState, useEffect } from "react";
import { FileIcon, FolderIcon, TrashIcon, RefreshCwIcon, AlertTriangleIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

export default function TrashPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trash");
      const data = await res.json();
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (err) {
      toast.error("Failed to load trash");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (id: string, type: "file" | "folder") => {
    try {
      const res = await fetch("/api/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type })
      });
      if (!res.ok) throw new Error("Restore failed");
      toast.success(`${type} restored`);
      fetchTrash();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePermanentDelete = async (id: string, type: "file" | "folder") => {
    if (!confirm("Delete forever? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/trash?id=${id}&type=${type}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`${type} permanently deleted`);
      fetchTrash();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const totalTrashSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wider neon-text flex items-center gap-3">
            <TrashIcon className="w-8 h-8 text-primary" />
            RECYCLE BIN
          </h1>
          <p className="text-gray-400 font-mono mt-2">Items in trash are automatically permanently deleted after 30 days.</p>
        </div>
        <div className="glass-panel px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
           <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />
           <div className="text-right">
             <p className="text-xs text-gray-400 font-mono">TRASH SIZE</p>
             <p className="text-sm font-bold text-white">{(totalTrashSize / 1024 / 1024).toFixed(2)} MB</p>
           </div>
        </div>
      </header>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden relative min-h-[400px]">
        {loading ? (
           <div className="absolute inset-0 flex items-center justify-center text-primary animate-pulse font-mono z-10 bg-black/20 backdrop-blur-sm">SCANNING TRASH SECTOR...</div>
        ) : (
          <table className="w-full text-left border-collapse relative">
            <thead>
              <tr className="text-xs font-mono text-gray-500 border-b border-white/10 bg-black/20">
                <th className="p-4 font-normal">NAME</th>
                <th className="p-4 font-normal">DELETED DATE</th>
                <th className="p-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {folders.map(folder => (
                <tr key={folder._id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="p-4 flex items-center gap-3 opacity-60">
                    <FolderIcon className="w-5 h-5 text-secondary" />
                    <span className="text-gray-300 font-medium line-through">{folder.name}</span>
                  </td>
                  <td className="p-4 text-sm text-gray-500 font-mono">
                    {folder.deletedAt ? format(new Date(folder.deletedAt), "MMM dd, yyyy") : "Unknown"}
                  </td>
                  <td className="p-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleRestore(folder._id, "folder")} 
                      className="px-3 py-1 bg-white/10 hover:bg-primary/20 text-white rounded text-sm transition-colors flex items-center gap-1 inline-flex"
                    >
                      <RefreshCwIcon className="w-4 h-4" /> Restore
                    </button>
                    <button 
                      onClick={() => handlePermanentDelete(folder._id, "folder")} 
                      className="px-3 py-1 bg-white/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors flex items-center gap-1 inline-flex"
                    >
                      <TrashIcon className="w-4 h-4" /> Delete Forever
                    </button>
                  </td>
                </tr>
              ))}

              {files.map(file => (
                <tr key={file._id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="p-4 flex items-center gap-3 opacity-60">
                    <FileIcon className="w-5 h-5 text-primary" />
                    <span className="text-gray-300 line-through">{file.originalName}</span>
                  </td>
                  <td className="p-4 text-sm text-gray-500 font-mono">
                    {file.deletedAt ? format(new Date(file.deletedAt), "MMM dd, yyyy") : "Unknown"}
                  </td>
                  <td className="p-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                      onClick={() => handleRestore(file._id, "file")} 
                      className="px-3 py-1 bg-white/10 hover:bg-primary/20 text-white rounded text-sm transition-colors flex items-center gap-1 inline-flex"
                    >
                      <RefreshCwIcon className="w-4 h-4" /> Restore
                    </button>
                    <button 
                      onClick={() => handlePermanentDelete(file._id, "file")} 
                      className="px-3 py-1 bg-white/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors flex items-center gap-1 inline-flex"
                    >
                      <TrashIcon className="w-4 h-4" /> Delete Forever
                    </button>
                  </td>
                </tr>
              ))}

              {files.length === 0 && folders.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500 font-mono">TRASH SECTOR IS EMPTY</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
