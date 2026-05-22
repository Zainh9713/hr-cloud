"use client";
import { FolderIcon, FileIcon, ShieldAlertIcon, DownloadIcon } from "lucide-react";

interface ArchivePreviewProps {
  filename: string;
  size: number;
  onDownload: () => void;
}

export default function ArchivePreview({ filename, size, onDownload }: ArchivePreviewProps) {
  // Generate some realistic cyberpunk-themed mock contents for the ZIP file based on its name
  const generateMockFiles = () => {
    const ext = filename.split(".").pop() || "zip";
    const nameWithoutExt = filename.replace(`.${ext}`, "");
    
    return [
      { name: `${nameWithoutExt}/`, isDir: true, size: 0 },
      { name: `${nameWithoutExt}/manifest.json`, isDir: false, size: 1024 * 2 },
      { name: `${nameWithoutExt}/index_sectors.dat`, isDir: false, size: Math.floor(size * 0.6) },
      { name: `${nameWithoutExt}/security_clearance.key`, isDir: false, size: 256 },
      { name: `${nameWithoutExt}/backup_log.log`, isDir: false, size: Math.floor(size * 0.3) }
    ];
  };

  const mockFiles = generateMockFiles();

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col bg-[#070714] border border-white/10 rounded-2xl overflow-hidden font-mono text-xs text-gray-300 shadow-2xl relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none rounded-2xl"></div>

      {/* Terminal Title */}
      <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between text-gray-400">
        <span>ARCHIVE COMPRESSION TREE INDEX</span>
        <span className="text-[10px] text-primary select-none">AES-256 ENCRYPTED SEC-GRID</span>
      </div>

      {/* Overview Card */}
      <div className="p-4 border-b border-white/5 bg-black/30 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-white font-bold text-sm truncate">{filename}</span>
          <span className="text-gray-500 text-[10px]">TOTAL ARCHIVED SIZE: {(size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/50 transition-all font-bold select-none text-[10px] tracking-wider uppercase"
        >
          <DownloadIcon className="w-3.5 h-3.5" /> EXTRACT NOW
        </button>
      </div>

      {/* Folder/File Index Listing */}
      <div className="p-4 flex flex-col gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar bg-black/20">
        {mockFiles.map((file, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
          >
            <div className="flex items-center gap-2">
              {file.isDir ? (
                <FolderIcon className="w-4 h-4 text-primary" />
              ) : (
                <FileIcon className="w-4 h-4 text-secondary" />
              )}
              <span className={file.isDir ? "text-primary font-bold" : "text-gray-300"}>{file.name}</span>
            </div>
            {!file.isDir && (
              <span className="text-gray-500 text-[10px]">{(file.size / 1024).toFixed(1)} KB</span>
            )}
          </div>
        ))}
      </div>

      {/* Security alert footer */}
      <div className="p-3 bg-yellow-950/10 border-t border-white/10 text-yellow-400/80 flex items-center gap-2 text-[10px] leading-relaxed">
        <ShieldAlertIcon className="w-4 h-4 flex-shrink-0" />
        <span>NOTICE: Preview represents internal virtual tree mapping. Always scan file hashes locally after extraction to ensure archive checksum alignment.</span>
      </div>
    </div>
  );
}
