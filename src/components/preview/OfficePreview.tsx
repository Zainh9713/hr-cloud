"use client";
import { useState, useEffect } from "react";
import { MonitorIcon, ShieldAlertIcon, DownloadIcon } from "lucide-react";

interface OfficePreviewProps {
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  onDownload: () => void;
}

function isLocalNetwork(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    hostname.endsWith(".local")
  );
}

export default function OfficePreview({
  userId,
  filename,
  originalName,
  mimeType,
  size,
  onDownload,
}: OfficePreviewProps) {
  const [isLocal, setIsLocal] = useState<boolean | null>(null);
  const [publicUrl, setPublicUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      setIsLocal(isLocalNetwork(hostname));
      setPublicUrl(`${window.location.origin}/storage/${userId}/${filename}`);
    }
  }, [userId, filename]);

  // Not yet determined
  if (isLocal === null) return null;

  if (isLocal) {
    return (
      <div className="w-full max-w-xl mx-auto flex flex-col bg-[#070714] border border-white/10 rounded-2xl overflow-hidden font-mono text-xs text-gray-300 shadow-2xl p-6 relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none rounded-2xl" />

        <div className="flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex items-center justify-center animate-pulse">
            <ShieldAlertIcon className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-bold text-sm tracking-wider uppercase">
              LOCAL SYSTEM SHIELD ACTIVE
            </h4>
            <p className="text-gray-400 text-[11px] leading-relaxed max-w-md">
              Microsoft Office Online Viewer requires a publicly accessible URL. Since H&amp;R Cloud is
              running on a local host (
              <span className="text-secondary">{typeof window !== "undefined" ? window.location.host : "localhost"}</span>
              ), the remote cloud engine cannot reach your secure local sector.
            </p>
          </div>

          <div className="w-full bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2 text-left">
            <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-white/5 pb-2">
              <span>FILE SECTOR DETECTED</span>
              <span>{(size / 1024).toFixed(1)} KB</span>
            </div>
            <span className="text-white font-bold truncate mt-1">{originalName}</span>
            <span className="text-gray-400 text-[10px]">MIME: {mimeType}</span>
          </div>

          <button
            onClick={onDownload}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 transition-all font-bold tracking-widest uppercase text-[10px]"
          >
            <DownloadIcon className="w-4 h-4" />
            RETRIEVE LOCAL DECODER FILE
          </button>

          <p className="text-[9px] text-gray-600 text-center">
            Deploy to Vercel / Render for online preview support via MS Office Online.
          </p>
        </div>
      </div>
    );
  }

  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;

  return (
    <div className="w-full h-[65vh] rounded-xl overflow-hidden border border-white/10 bg-white">
      <iframe
        src={officeViewerUrl}
        className="w-full h-full border-0"
        title={`Office Preview: ${originalName}`}
        allow="fullscreen"
      />
    </div>
  );
}
