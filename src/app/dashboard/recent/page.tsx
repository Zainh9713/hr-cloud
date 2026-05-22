"use client";
import { useState, useEffect } from "react";
import { FileIcon, DownloadIcon, EyeIcon, ClockIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import FilePreviewModal from "@/components/FilePreviewModal";

export default function RecentPage() {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  const fetchRecent = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/recent");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load recent files");
      setFiles(data.files || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load recent files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] tracking-wider">
            RECENT TELEMETRY
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1 uppercase tracking-widest">
            Chronological audit log of recently modified assets.
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden relative">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-primary animate-pulse font-mono z-10 bg-black/20 backdrop-blur-sm">
              RETRIEVING TELEMETRY LOGS...
            </div>
          ) : null}

          <table className="w-full text-left border-collapse relative">
            <thead>
              <tr className="text-xs font-mono text-gray-500 border-b border-white/10 bg-black/20">
                <th className="p-4 font-normal">NAME</th>
                <th className="p-4 font-normal">SIZE</th>
                <th className="p-4 font-normal">LAST MODIFIED</th>
                <th className="p-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file._id}
                  className="border-b border-white/5 hover:bg-white/5 transition-all duration-150 group cursor-pointer"
                  onClick={() => setPreviewFile(file)}
                >
                  <td className="p-4 flex items-center gap-3">
                    <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-white font-medium group-hover:text-primary transition-colors font-sans">
                      {file.originalName}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-mono flex items-center gap-1.5">
                    <ClockIcon className="w-3.5 h-3.5 text-gray-600" />
                    {format(new Date(file.updatedAt), "MMM dd, yyyy HH:mm")}
                  </td>
                  <td className="p-4 text-right space-x-2">
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

              {files.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 font-mono">
                    NO TELEMETRY RECORDED IN THE LAST 50 OPERATIONS
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
