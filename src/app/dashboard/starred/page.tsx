"use client";
import { useState, useEffect } from "react";
import { FileIcon, FolderIcon, StarIcon, ArrowRightIcon, DownloadIcon, EyeIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import FilePreviewModal from "@/components/FilePreviewModal";
import { useRouter } from "next/navigation";

export default function StarredPage() {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const router = useRouter();

  const fetchStarred = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/starred");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load starred files");
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load starred data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStarred();
  }, []);

  const handleUnstar = async (e: React.MouseEvent, id: string, type: "file" | "folder") => {
    e.stopPropagation();
    try {
      const endpoint = type === "file" ? "/api/files" : "/api/folders";
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isStarred: false })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Removed from Starred");
      fetchStarred(); // Reload
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
  };

  const handleNavigateToFolder = (folderId: string) => {
    router.push(`/dashboard/files?folder=${folderId}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] tracking-wider">
            FAVORITES CORE
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1 uppercase tracking-widest">
            Access starred files and folders across all database grids.
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden relative">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-primary animate-pulse font-mono z-10 bg-black/20 backdrop-blur-sm">
              SCANNING STARRED GRID...
            </div>
          ) : null}

          <table className="w-full text-left border-collapse relative">
            <thead>
              <tr className="text-xs font-mono text-gray-500 border-b border-white/10 bg-black/20">
                <th className="p-4 font-normal">NAME</th>
                <th className="p-4 font-normal">TYPE</th>
                <th className="p-4 font-normal">SIZE</th>
                <th className="p-4 font-normal">MODIFIED</th>
                <th className="p-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {/* Folders */}
              {folders.map((folder) => (
                <tr
                  key={folder._id}
                  className="border-b border-white/5 hover:bg-white/5 transition-all duration-150 group cursor-pointer"
                  onClick={() => handleNavigateToFolder(folder._id)}
                >
                  <td className="p-4 flex items-center gap-3">
                    <FolderIcon
                      className="w-5 h-5 flex-shrink-0"
                      style={{
                        color: folder.color || "#0ea5e9",
                        filter: `drop-shadow(0 0 4px ${folder.color || "#0ea5e9"}33)`,
                      }}
                    />
                    <span className="text-white font-medium group-hover:text-primary transition-colors">
                      {folder.name}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-mono text-cyan-500 uppercase">Sector</td>
                  <td className="p-4 text-sm text-gray-400 font-mono">--</td>
                  <td className="p-4 text-sm text-gray-400 font-mono">
                    {format(new Date(folder.updatedAt), "MMM dd, yyyy")}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={(e) => handleUnstar(e, folder._id, "folder")}
                      className="text-yellow-400 hover:text-gray-400 p-2 transition-colors"
                      title="Unstar"
                    >
                      <StarIcon className="w-4 h-4 fill-yellow-400" />
                    </button>
                    <button
                      onClick={() => handleNavigateToFolder(folder._id)}
                      className="text-gray-500 hover:text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Open Folder"
                    >
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Files */}
              {files.map((file) => (
                <tr
                  key={file._id}
                  className="border-b border-white/5 hover:bg-white/5 transition-all duration-150 group cursor-pointer"
                  onClick={() => setPreviewFile(file)}
                >
                  <td className="p-4 flex items-center gap-3">
                    <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-white font-medium group-hover:text-primary transition-colors">
                      {file.originalName}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-mono text-purple-400 uppercase">File</td>
                  <td className="p-4 text-sm text-gray-400 font-mono">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono">
                    {format(new Date(file.updatedAt), "MMM dd, yyyy")}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={(e) => handleUnstar(e, file._id, "file")}
                      className="text-yellow-400 hover:text-gray-400 p-2 transition-colors"
                      title="Unstar"
                    >
                      <StarIcon className="w-4 h-4 fill-yellow-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/files/download?id=${file._id}`, "_blank");
                      }}
                      className="text-gray-500 hover:text-secondary p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="text-gray-500 hover:text-primary p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Preview"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {files.length === 0 && folders.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                    NO STARRED ASSETS REGISTERED IN NEURAL NETWORK
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
