import connectDB from "@/lib/db";
import SharedLink from "@/models/SharedLink";
import FileModel from "@/models/File";
import { notFound } from "next/navigation";
import { FileIcon, DownloadIcon } from "lucide-react";
import { format } from "date-fns";

export default async function SharedFilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  await connectDB();
  
  const share = await SharedLink.findOne({ token }).populate("fileId");
  
  if (!share || share.isRevoked) {
    return (
      <div className="min-h-screen bg-[#05050f] flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl text-center max-w-md w-full border border-red-500/30">
          <h1 className="text-2xl font-bold text-red-500 neon-text mb-4">ACCESS DENIED</h1>
          <p className="text-gray-400 font-mono text-sm">This secure link is invalid or has been revoked by the owner.</p>
        </div>
      </div>
    );
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-[#05050f] flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl text-center max-w-md w-full border border-yellow-500/30">
          <h1 className="text-2xl font-bold text-yellow-500 neon-text mb-4">LINK EXPIRED</h1>
          <p className="text-gray-400 font-mono text-sm">This secure link has expired and is no longer accessible.</p>
        </div>
      </div>
    );
  }

  const file = share.fileId;

  // We need to fetch the file details via a proxy download route. We can use the existing download route, 
  // but it requires auth. We need a public download route `GET /api/share/download?token=xxx`.
  
  return (
    <div className="min-h-screen bg-[#05050f] flex items-center justify-center p-4 bg-[url('/grid.svg')] bg-center relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
      
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-primary/30 relative z-10 shadow-[0_0_50px_rgba(139,92,246,0.15)] animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 neon-border relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/20 animate-ping"></div>
            <FileIcon className="w-10 h-10 text-primary relative z-10" />
          </div>
          
          <h1 className="text-xl font-bold text-white mb-2 break-all">{file.originalName}</h1>
          <p className="text-gray-400 font-mono text-sm mb-8">
            {(file.size / 1024 / 1024).toFixed(2)} MB • Shared via H&R Cloud
          </p>
          
          <a 
            href={`/api/share/download?token=${token}`}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:scale-[1.02]"
          >
            <DownloadIcon className="w-5 h-5" />
            INITIATE DOWNLOAD
          </a>
        </div>
      </div>
    </div>
  );
}
