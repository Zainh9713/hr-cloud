"use client";
import { useCallback, useState } from "react";
import { UploadCloudIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadStore } from "@/store/useUploadStore";
import { useFileStore } from "@/store/useFileStore";

export default function FileUploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const { addUploads } = useUploadStore();
  const currentFolderId = useFileStore((state) => state.currentFolderId);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addUploads(Array.from(e.dataTransfer.files), currentFolderId);
    }
  }, [addUploads, currentFolderId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addUploads(Array.from(e.target.files), currentFolderId);
    }
  };

  return (
    <div 
      className={cn(
        "glass-panel rounded-2xl p-8 border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden",
        isDragging ? "border-primary bg-primary/10 neon-border scale-[1.02]" : "border-white/20 hover:border-primary/50 hover:bg-white/5"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        multiple
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleFileChange}
      />
      
      <>
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <UploadCloudIcon className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2 font-mono">INITIALIZE DATA TRANSFER</h3>
        <p className="text-sm text-gray-400 font-mono">Drag & drop files or click to browse</p>
      </>
    </div>
  );
}
