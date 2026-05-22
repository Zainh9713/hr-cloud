"use client";
import React, { useState, useRef } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { PlusIcon } from "lucide-react";
import { useUploadStore } from "@/store/useUploadStore";
import { useFileStore } from "@/store/useFileStore";
import { toast } from "react-hot-toast";
import UploadQueue from "./UploadQueue";

interface DashboardContainerProps {
  user: any;
  children: React.ReactNode;
}

export default function DashboardContainer({ user, children }: DashboardContainerProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { addUploads } = useUploadStore();
  const currentFolderId = useFileStore((state) => state.currentFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFabClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      addUploads(filesArray, currentFolderId);
      toast.success(`Queued ${filesArray.length} uploads`);
      e.target.value = "";
    }
  };

  return (
    <div className="flex min-h-screen bg-[#05050f] text-white overflow-x-hidden relative">
      {/* Backdrop (mobile sidebar drawer overlay) */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Responsive Sidebar Drawer */}
      <Sidebar
        className={`fixed inset-y-0 left-0 z-40 transform lg:transform-none lg:translate-x-0 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 transition-all duration-300">
        <Topbar user={user} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className="flex-1 p-4 md:p-8 overflow-y-auto relative min-w-0">
          {children}
          <UploadQueue />
        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        onClick={handleFabClick}
        className="fixed bottom-6 right-6 lg:hidden z-30 w-14 h-14 rounded-full bg-gradient-to-r from-[#d946ef] to-[#0ea5e9] text-white flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.5)] hover:shadow-[0_0_25px_rgba(14,165,233,0.8)] active:scale-95 transition-all cursor-pointer border border-white/20 animate-bounce"
        title="Upload Files"
      >
        <PlusIcon className="w-7 h-7" />
      </button>

      {/* Hidden file input for FAB upload */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
