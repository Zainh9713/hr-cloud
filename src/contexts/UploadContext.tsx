"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { toast } from "react-hot-toast";

export type UploadStatus = "pending" | "uploading" | "success" | "error" | "canceled";

export interface UploadItem {
  id: string;
  file: File;
  folderId: string | null;
  progress: number;
  status: UploadStatus;
  error?: string;
  xhr?: XMLHttpRequest;
  speed?: number; // bytes per second
  eta?: number; // seconds remaining
}

interface UploadContextType {
  uploads: UploadItem[];
  addUploads: (files: File[], folderId: string | null) => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  clearCompleted: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const MAX_CONCURRENT = 3;

  const updateUpload = useCallback((id: string, data: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
  }, []);

  const addUploads = useCallback((files: File[], folderId: string | null) => {
    const newUploads: UploadItem[] = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      folderId,
      progress: 0,
      status: "pending",
    }));
    setUploads((prev) => [...prev, ...newUploads]);
  }, []);

  const cancelUpload = useCallback((id: string) => {
    setUploads((prev) => {
      const upload = prev.find((u) => u.id === id);
      if (upload && upload.status === "uploading" && upload.xhr) {
        upload.xhr.abort();
      }
      return prev.map((u) => (u.id === id ? { ...u, status: "canceled" } : u));
    });
  }, []);

  const retryUpload = useCallback((id: string) => {
    updateUpload(id, { status: "pending", progress: 0, error: undefined });
  }, [updateUpload]);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== "success" && u.status !== "canceled"));
  }, []);

  // Process queue
  useEffect(() => {
    const uploadingCount = uploads.filter((u) => u.status === "uploading").length;
    const pendingUploads = uploads.filter((u) => u.status === "pending");

    if (uploadingCount < MAX_CONCURRENT && pendingUploads.length > 0) {
      const slotsAvailable = MAX_CONCURRENT - uploadingCount;
      const toStart = pendingUploads.slice(0, slotsAvailable);

      toStart.forEach((upload) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", upload.file);
        if (upload.folderId) {
          formData.append("folderId", upload.folderId);
        }

        let startTime = Date.now();
        let lastLoaded = 0;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded * 100) / event.total);
            
            // Calculate speed and ETA every ~second or dynamically
            const now = Date.now();
            const timeElapsed = (now - startTime) / 1000; // in seconds
            let speed = 0;
            let eta = 0;
            if (timeElapsed > 0.5) {
               speed = (event.loaded - lastLoaded) / timeElapsed; // bytes per second
               const remainingBytes = event.total - event.loaded;
               eta = speed > 0 ? remainingBytes / speed : 0;
               startTime = now;
               lastLoaded = event.loaded;
            }

            updateUpload(upload.id, { progress, speed, eta });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            updateUpload(upload.id, { status: "success", progress: 100 });
            toast.success(`${upload.file.name} uploaded`);
          } else {
            let errorMsg = "Upload failed";
            try {
              const res = JSON.parse(xhr.responseText);
              errorMsg = res.error || errorMsg;
            } catch (e) {}
            updateUpload(upload.id, { status: "error", error: errorMsg });
            toast.error(errorMsg);
          }
        };

        xhr.onerror = () => {
          updateUpload(upload.id, { status: "error", error: "Network error" });
        };

        xhr.onabort = () => {
          updateUpload(upload.id, { status: "canceled" });
        };

        xhr.open("POST", "/api/files");
        xhr.send(formData);

        updateUpload(upload.id, { status: "uploading", xhr });
      });
    }
  }, [uploads, updateUpload]);

  return (
    <UploadContext.Provider value={{ uploads, addUploads, cancelUpload, retryUpload, clearCompleted }}>
      {children}
    </UploadContext.Provider>
  );
}

export const useUploads = () => {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error("useUploads must be used within an UploadProvider");
  }
  return context;
};
