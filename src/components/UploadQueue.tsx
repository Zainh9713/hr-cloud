"use client";

import { useState } from "react";
import { useUploadStore } from "@/store/useUploadStore";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon, MinusIcon, Maximize2Icon, PlayIcon, PauseIcon, RefreshCwIcon, CheckCircle2Icon, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UploadQueue() {
  const { uploads, cancelUpload, pauseUpload, resumeUpload, retryUpload, clearCompleted, removeUpload } = useUploadStore();
  const [isMinimized, setIsMinimized] = useState(false);

  if (uploads.length === 0) return null;

  const uploadingCount = uploads.filter(u => u.status === "uploading" || u.status === "pending" || u.status === "paused").length;
  const hasCompleted = uploads.some(u => u.status === "success" || u.status === "error" || u.status === "canceled");

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 flex flex-col shadow-[0_0_30px_rgba(139,92,246,0.25)] border border-white/10 rounded-xl overflow-hidden bg-[#070714]/95 backdrop-blur-xl">
      {/* Header */}
      <div className="bg-white/5 p-3 flex items-center justify-between border-b border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
          {uploadingCount > 0 ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#0ea5e9]"></span>
              TRANSFERS ACTIVE ({uploadingCount})
            </>
          ) : (
            <>
              <CheckCircle2Icon className="w-4 h-4 text-green-500" />
              DATABANKS SYNCED
            </>
          )}
        </h3>
        <div className="flex gap-2 items-center">
          {hasCompleted && (
            <button onClick={clearCompleted} className="p-1 text-gray-400 hover:text-white transition-colors" title="Clear Completed">
              <XIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 text-gray-400 hover:text-white transition-colors">
            {isMinimized ? <Maximize2Icon className="w-4 h-4" /> : <MinusIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-white/5"
          >
            {uploads.slice().reverse().map((upload) => {
              const isError = upload.status === "error";
              const isCanceled = upload.status === "canceled";
              const isSuccess = upload.status === "success";
              const isPaused = upload.status === "paused";
              const speedMB = upload.speed ? (upload.speed / 1024 / 1024).toFixed(2) : "0.00";
              
              let etaStr = "Calculating...";
              if (upload.eta && upload.eta > 0) {
                if (upload.eta < 60) etaStr = `${Math.round(upload.eta)}s`;
                else etaStr = `${Math.round(upload.eta / 60)}m`;
              }

              return (
                <div key={upload.id} className="p-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileIcon className={cn("w-6 h-6 flex-shrink-0", isSuccess ? "text-green-500" : isError || isCanceled ? "text-red-500" : "text-primary")} />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate font-mono">{upload.file.name}</p>
                      
                      <div className="flex justify-between items-end mt-1">
                        <div className="w-full mr-3 relative pt-1">
                          {upload.status === "uploading" ? (
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-1">
                              <span>{speedMB} MB/s</span>
                              <span>{etaStr} remaining</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-400 font-mono mb-1">
                              {isSuccess ? "Complete" : isError ? upload.error : isCanceled ? "Canceled" : isPaused ? "Paused" : "Connecting..."}
                            </div>
                          )}
                          
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-300", 
                                isSuccess ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : isError || isCanceled ? "bg-red-500" : isPaused ? "bg-yellow-500" : "bg-primary shadow-[0_0_8px_#0ea5e9]"
                              )}
                              style={{ width: `${upload.progress}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {upload.status === "uploading" && (
                            <button onClick={() => pauseUpload(upload.id)} className="p-1 text-gray-400 hover:text-yellow-400 bg-white/5 rounded transition-colors" title="Pause">
                              <PauseIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          {isPaused && (
                            <button onClick={() => resumeUpload(upload.id)} className="p-1 text-gray-400 hover:text-primary bg-white/5 rounded transition-colors" title="Resume">
                              <PlayIcon className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(upload.status === "uploading" || upload.status === "pending" || isPaused) && (
                            <button onClick={() => cancelUpload(upload.id)} className="p-1 text-gray-400 hover:text-red-400 bg-white/5 rounded transition-colors" title="Cancel">
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          {(isError || isCanceled) && (
                            <button onClick={() => retryUpload(upload.id)} className="p-1 text-gray-400 hover:text-primary bg-white/5 rounded transition-colors" title="Retry">
                              <RefreshCwIcon className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(isSuccess || isError || isCanceled) && (
                            <button onClick={() => removeUpload(upload.id)} className="p-1 text-gray-400 hover:text-red-400 bg-white/5 rounded transition-colors" title="Dismiss">
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
