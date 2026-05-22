"use client";

import FileManager from "@/components/FileManager";
import FileUploadZone from "@/components/FileUploadZone";

export default function FilesPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] tracking-wider">
        DATA MATRIX
      </h1>
      <FileUploadZone />
      <FileManager />
    </div>
  );
}
