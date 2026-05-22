"use client";
import { useState, useEffect } from "react";
import { FileIcon, FolderIcon, ArrowRightIcon, DownloadIcon, EyeIcon, UserIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import FilePreviewModal from "@/components/FilePreviewModal";
import { useRouter } from "next/navigation";

export default function SharedPage() {
  const [loading, setLoading] = useState(true);
  const [sharedLinks, setSharedLinks] = useState<any[]>([]);
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const router = useRouter();

  const fetchShared = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/share/shared-with-me");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load shared assets");
      setSharedLinks(data.sharedLinks || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load shared assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShared();
  }, []);

  const handleNavigateToFolder = (folderId: string) => {
    router.push(`/dashboard/files?folder=${folderId}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] tracking-wider">
            SHARED ARCHIVES
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1 uppercase tracking-widest">
            Sectors and assets decrypted for collaborative access.
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden relative">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-primary animate-pulse font-mono z-10 bg-black/20 backdrop-blur-sm">
              DECRYPTING SHARE PROTOCOLS...
            </div>
          ) : null}

          <table className="w-full text-left border-collapse relative">
            <thead>
              <tr className="text-xs font-mono text-gray-500 border-b border-white/10 bg-black/20">
                <th className="p-4 font-normal">NAME</th>
                <th className="p-4 font-normal">TYPE</th>
                <th className="p-4 font-normal">OWNER</th>
                <th className="p-4 font-normal">ACCESS RULE</th>
                <th className="p-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sharedLinks.map((link) => {
                const isFolder = !!link.folderId;
                const asset = isFolder ? link.folderId : link.fileId;
                if (!asset) return null; // Avoid rendering broken shares

                return (
                  <tr
                    key={link._id}
                    className="border-b border-white/5 hover:bg-white/5 transition-all duration-150 group cursor-pointer"
                    onClick={() => {
                      if (isFolder) {
                        handleNavigateToFolder(asset._id);
                      } else {
                        setPreviewFile(asset);
                      }
                    }}
                  >
                    <td className="p-4 flex items-center gap-3">
                      {isFolder ? (
                        <FolderIcon
                          className="w-5 h-5 flex-shrink-0"
                          style={{
                            color: asset.color || "#0ea5e9",
                            filter: `drop-shadow(0 0 4px ${asset.color || "#0ea5e9"}33)`,
                          }}
                        />
                      ) : (
                        <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                      <span className="text-white font-medium group-hover:text-primary transition-colors">
                        {isFolder ? asset.name : asset.originalName}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-mono text-cyan-500 uppercase">
                      {isFolder ? "Sector" : "File"}
                    </td>
                    <td className="p-4 text-sm text-gray-400 font-mono flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-gray-600" />
                      {link.ownerId?.username || "Unknown"} ({link.ownerId?.email || ""})
                    </td>
                    <td className="p-4 text-xs font-mono text-purple-400 uppercase">
                      {link.role === "editor" ? "Read/Write" : "Read-Only"}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {isFolder ? (
                        <button
                          onClick={() => handleNavigateToFolder(asset._id)}
                          className="text-gray-500 hover:text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open Folder"
                        >
                          <ArrowRightIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/api/files/download?id=${asset._id}`, "_blank");
                            }}
                            className="text-gray-500 hover:text-secondary p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download"
                          >
                            <DownloadIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPreviewFile(asset)}
                            className="text-gray-500 hover:text-primary p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Preview"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {sharedLinks.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                    NO DECRYPTED COLLABORATIVE SHARES DETECTED
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
