import { create } from "zustand";
import { toast } from "react-hot-toast";

export type UploadStatus = "pending" | "uploading" | "paused" | "success" | "error" | "canceled";

export interface UploadItem {
  id: string;
  file: File;
  folderId: string | null;
  progress: number;
  status: UploadStatus;
  error?: string;
  speed?: number; // bytes per second
  eta?: number; // seconds remaining
  uploadId?: string;
  paused?: boolean;
  totalChunks?: number;
  uploadedChunks: number[];
  activeXhrs?: { [key: number]: XMLHttpRequest };
  chunkRetries?: { [key: number]: number };
  retryingChunks?: { [key: number]: boolean };
  diagnosticsLogs?: string[];
}

interface UploadState {
  uploads: UploadItem[];
  addUploads: (files: File[], folderId: string | null, onUploadSuccess?: () => void) => void;
  cancelUpload: (id: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  clearCompleted: () => void;
  processQueue: (onUploadSuccess?: () => void) => void;
  uploadNextChunks: (uploadItemId: string, onUploadSuccess?: () => void) => void;
  mergeFileChunks: (uploadItemId: string, onUploadSuccess?: () => void) => Promise<void>;
  removeUpload: (id: string) => void;
}

// Generate a fast file hash based on metadata
function getFileHash(file: File): string {
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, "");
  return `h_${cleanName}_${file.size}_${file.lastModified}`;
}

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk slices

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: [],

  addUploads: (files, folderId, onUploadSuccess) => {
    const newUploads: UploadItem[] = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      folderId,
      progress: 0,
      status: "pending",
      uploadedChunks: [],
      activeXhrs: {},
      chunkRetries: {},
      retryingChunks: {},
      diagnosticsLogs: [`[${new Date().toLocaleTimeString()}] File queued for upload.`]
    }));

    set((state) => ({ uploads: [...state.uploads, ...newUploads] }));
    get().processQueue(onUploadSuccess);
  },

  cancelUpload: (id) => {
    set((state) => {
      const upload = state.uploads.find((u) => u.id === id);
      if (upload) {
        if (upload.activeXhrs) {
          Object.values(upload.activeXhrs).forEach((xhr) => xhr.abort());
        }
      }
      return {
        uploads: state.uploads.map((u) => (u.id === id ? { 
          ...u, 
          status: "canceled" as const, 
          activeXhrs: {}, 
          chunkRetries: {}, 
          retryingChunks: {},
          diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Upload canceled.`]
        } : u))
      };
    });
  },

  pauseUpload: (id) => {
    set((state) => {
      const upload = state.uploads.find((u) => u.id === id);
      if (upload && upload.status === "uploading") {
        if (upload.activeXhrs) {
          Object.values(upload.activeXhrs).forEach((xhr) => xhr.abort());
        }
        return {
          uploads: state.uploads.map((u) => (u.id === id ? { 
            ...u, 
            status: "paused" as const, 
            paused: true, 
            activeXhrs: {},
            retryingChunks: {},
            diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Upload paused.`]
          } : u))
        };
      }
      return state;
    });
  },

  resumeUpload: (id) => {
    set((state) => ({
      uploads: state.uploads.map((u) => (u.id === id ? { 
        ...u, 
        status: "pending" as const, 
        paused: false,
        diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Resuming upload...`]
      } : u))
    }));
    get().processQueue();
  },

  retryUpload: (id) => {
    set((state) => ({
      uploads: state.uploads.map((u) => (u.id === id ? { 
        ...u, 
        status: "pending" as const, 
        progress: 0, 
        error: undefined, 
        uploadedChunks: [], 
        activeXhrs: {},
        chunkRetries: {},
        retryingChunks: {},
        diagnosticsLogs: [`[${new Date().toLocaleTimeString()}] Retrying upload...`]
      } : u))
    }));
    get().processQueue();
  },

  clearCompleted: () => {
    set((state) => ({
      uploads: state.uploads.filter((u) => u.status === "uploading" || u.status === "pending" || u.status === "paused")
    }));
  },

  removeUpload: (id) => {
    set((state) => {
      const upload = state.uploads.find((u) => u.id === id);
      if (upload && upload.activeXhrs) {
        Object.values(upload.activeXhrs).forEach((xhr) => xhr.abort());
      }
      return {
        uploads: state.uploads.filter((u) => u.id !== id)
      };
    });
  },

  processQueue: (onUploadSuccess) => {
    const { uploads } = get();
    const uploadingCount = uploads.filter((u) => u.status === "uploading").length;
    const pendingUploads = uploads.filter((u) => u.status === "pending" && !u.paused);
    const MAX_CONCURRENT_FILES = 2;

    if (uploadingCount < MAX_CONCURRENT_FILES && pendingUploads.length > 0) {
      const slotsAvailable = MAX_CONCURRENT_FILES - uploadingCount;
      const filesToStart = pendingUploads.slice(0, slotsAvailable);

      filesToStart.forEach(async (upload) => {
        // Mark file as uploading
        set((state) => ({
          uploads: state.uploads.map((u) => (u.id === upload.id ? { ...u, status: "uploading" } : u))
        }));

        try {
          const fileHash = getFileHash(upload.file);
          // 1. Initialize or resume chunked session
          const initUrl = `/api/files/upload-chunk?fileName=${encodeURIComponent(upload.file.name)}&fileSize=${upload.file.size}&hash=${fileHash}&folderId=${upload.folderId || "null"}`;
          const initRes = await fetch(initUrl);
          
          if (!initRes.ok) {
            throw new Error(`Session initialization failed: ${initRes.statusText}`);
          }
          
          const initData = await initRes.json();
          const { uploadId, uploadedChunks, totalChunks } = initData;

          set((state) => ({
            uploads: state.uploads.map((u) => (u.id === upload.id ? { ...u, uploadId, totalChunks, uploadedChunks } : u))
          }));

          // Start chunk uploads
          get().uploadNextChunks(upload.id, onUploadSuccess);
        } catch (err: any) {
          set((state) => ({
            uploads: state.uploads.map((u) => (u.id === upload.id ? { ...u, status: "error", error: err.message || "Failed to initialize" } : u))
          }));
          toast.error(`Upload error: ${upload.file.name}`);
          get().processQueue(onUploadSuccess);
        }
      });
    }
  },

  // Internal helper to upload outstanding chunks for an upload session
  uploadNextChunks: (uploadItemId: string, onUploadSuccess?: () => void) => {
    const { uploads } = get();
    const upload = uploads.find((u) => u.id === uploadItemId);
    if (!upload || upload.status !== "uploading" || upload.paused) return;

    const totalChunks = upload.totalChunks || 0;
    const uploadedChunks = upload.uploadedChunks || [];
    const activeXhrs = upload.activeXhrs || {};
    const retryingChunks = upload.retryingChunks || {};

    const activeCount = Object.keys(activeXhrs).length;
    const MAX_CONCURRENT_CHUNKS_PER_FILE = 2; // parallel chunk uploads!
    const MAX_RETRIES = 5;

    // Check if all chunks are uploaded
    if (uploadedChunks.length === totalChunks) {
      get().mergeFileChunks(uploadItemId, onUploadSuccess);
      return;
    }

    const handleChunkFailure = (chunkIndex: number, errorMsg: string) => {
      const { uploads: currentUploads } = get();
      const currentUpload = currentUploads.find((u) => u.id === uploadItemId);
      if (!currentUpload || currentUpload.status !== "uploading" || currentUpload.paused) return;

      const retries = currentUpload.chunkRetries?.[chunkIndex] || 0;
      const nextXhrs = { ...currentUpload.activeXhrs };
      delete nextXhrs[chunkIndex];

      console.warn(`[NEURAL-UPLOAD-DIAGNOSTICS] Chunk ${chunkIndex} upload failed (Attempt ${retries + 1}/${MAX_RETRIES}): ${errorMsg}`);

      if (retries < MAX_RETRIES) {
        const nextRetries = { ...(currentUpload.chunkRetries || {}), [chunkIndex]: retries + 1 };
        const nextRetrying = { ...(currentUpload.retryingChunks || {}), [chunkIndex]: true };

        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === uploadItemId
              ? {
                  ...u,
                  activeXhrs: nextXhrs,
                  chunkRetries: nextRetries,
                  retryingChunks: nextRetrying,
                  diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Chunk ${chunkIndex} failed, retrying (Attempt ${retries + 1}/${MAX_RETRIES}): ${errorMsg}`]
                }
              : u
          )
        }));

        // Exponential backoff retry with jitter
        const backoffDelay = Math.pow(2, retries) * 1000 + Math.random() * 500;
        setTimeout(() => {
          // Clear retrying state first
          set((state) => ({
            uploads: state.uploads.map((u) => {
              if (u.id === uploadItemId) {
                const nextRetryingChunks = { ...(u.retryingChunks || {}) };
                delete nextRetryingChunks[chunkIndex];
                return { ...u, retryingChunks: nextRetryingChunks };
              }
              return u;
            })
          }));
          get().uploadNextChunks(uploadItemId, onUploadSuccess);
        }, backoffDelay);
      } else {
        // Out of retries, fail the upload permanently
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === uploadItemId
              ? {
                  ...u,
                  status: "error",
                  error: `Chunk ${chunkIndex} failed after ${MAX_RETRIES} retries.`,
                  activeXhrs: nextXhrs,
                  diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Chunk ${chunkIndex} failed permanently: ${errorMsg}`]
                }
              : u
          )
        }));
        toast.error(`Upload failed for ${currentUpload.file.name}: Chunk ${chunkIndex} failed.`);
        get().processQueue(onUploadSuccess);
      }
    };

    if (activeCount < MAX_CONCURRENT_CHUNKS_PER_FILE) {
      // Find a chunk that is not uploaded, not active, and not currently waiting in backoff retry
      const nextChunkIndex = Array.from({ length: totalChunks }, (_, i) => i)
        .find((i) => !uploadedChunks.includes(i) && !activeXhrs[i] && !retryingChunks[i]);

      if (nextChunkIndex !== undefined) {
        const start = nextChunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, upload.file.size);
        const chunkBlob = upload.file.slice(start, end);

        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("uploadId", upload.uploadId || "");
        formData.append("chunkIndex", nextChunkIndex.toString());
        formData.append("chunk", chunkBlob);

        // Set request timeout to prevent hanging uploads
        xhr.timeout = 30000; // 30s timeout

        let startTime = Date.now();
        let lastLoaded = 0;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            let speed = 0;
            let eta = 0;

            if (elapsed > 0.5) {
              speed = (event.loaded - lastLoaded) / elapsed; // bytes/sec
              const totalUploadedBytes = (upload.uploadedChunks.length * CHUNK_SIZE) + event.loaded;
              const remainingBytes = upload.file.size - totalUploadedBytes;
              eta = speed > 0 ? remainingBytes / speed : 0;
              startTime = now;
              lastLoaded = event.loaded;
            }

            // Calculate overall progress based on chunk ratios
            const completedRatio = upload.uploadedChunks.length / totalChunks;
            const currentChunkRatio = (event.loaded / event.total) / totalChunks;
            const progress = Math.round((completedRatio + currentChunkRatio) * 100);

            set((state) => ({
              uploads: state.uploads.map((u) => 
                u.id === uploadItemId ? { ...u, progress: Math.min(progress, 99), speed, eta } : u
              )
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let nextUploaded: number[] = [];
            set((state) => {
              const item = state.uploads.find((u) => u.id === uploadItemId);
              if (!item) return state;
              nextUploaded = [...item.uploadedChunks];
              if (!nextUploaded.includes(nextChunkIndex)) {
                nextUploaded.push(nextChunkIndex);
              }
              const nextXhrs = { ...item.activeXhrs };
              delete nextXhrs[nextChunkIndex];

              const progress = Math.round((nextUploaded.length / (item.totalChunks || 1)) * 100);

              return {
                uploads: state.uploads.map((u) => 
                  u.id === uploadItemId ? { 
                    ...u, 
                    uploadedChunks: nextUploaded, 
                    activeXhrs: nextXhrs, 
                    progress: Math.min(progress, 99),
                    diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Chunk ${nextChunkIndex} uploaded successfully.`]
                  } : u
                )
              };
            });

            console.log(`[NEURAL-UPLOAD-DIAGNOSTICS] Chunk ${nextChunkIndex} for upload ${uploadItemId} completed. Current progress: ${nextUploaded.length}/${totalChunks} chunks.`);
            
            // Queue the next chunk
            get().uploadNextChunks(uploadItemId, onUploadSuccess);
          } else {
            handleChunkFailure(nextChunkIndex, `Server returned status ${xhr.status}`);
          }
        };

        xhr.onerror = () => {
          handleChunkFailure(nextChunkIndex, "Network connection error");
        };

        xhr.ontimeout = () => {
          handleChunkFailure(nextChunkIndex, "Connection timed out (30s)");
        };

        // Track XMLHttpRequests locally
        set((state) => ({
          uploads: state.uploads.map((u) => {
            if (u.id === uploadItemId) {
              return {
                ...u,
                activeXhrs: { ...u.activeXhrs, [nextChunkIndex]: xhr }
              };
            }
            return u;
          })
        }));

        xhr.open("POST", "/api/files/upload-chunk");
        xhr.send(formData);

        // Queue other concurrent chunk if slot exists
        get().uploadNextChunks(uploadItemId, onUploadSuccess);
      }
    }
  },

  // Final merge call when all chunks are loaded
  mergeFileChunks: async (uploadItemId: string, onUploadSuccess?: () => void) => {
    const { uploads } = get();
    const upload = uploads.find((u) => u.id === uploadItemId);
    if (!upload || upload.status !== "uploading") return;

    set((state) => ({
      uploads: state.uploads.map((u) => (u.id === uploadItemId ? {
        ...u,
        diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] All chunks uploaded. Starting file reassembly (merge)...`]
      } : u))
    }));

    try {
      const res = await fetch("/api/files/merge-chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: upload.uploadId,
          mimeType: upload.file.type
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to merge chunk parts");
      }

      set((state) => ({
        uploads: state.uploads.map((u) => (u.id === uploadItemId ? { 
          ...u, 
          status: "success", 
          progress: 100,
          diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Merge complete. File registered in databanks.`]
        } : u))
      }));
      toast.success(`${upload.file.name} uploaded successfully!`);

      // Refresh standard file views
      try {
        const { useFileStore } = require("./useFileStore");
        useFileStore.getState().fetchData();
      } catch (err) {
        console.error("Failed to auto-refresh files:", err);
      }

      if (onUploadSuccess) onUploadSuccess();
      get().processQueue(onUploadSuccess);
    } catch (err: any) {
      set((state) => ({
        uploads: state.uploads.map((u) => (u.id === uploadItemId ? { 
          ...u, 
          status: "error", 
          error: err.message || "Failed to merge",
          diagnosticsLogs: [...(u.diagnosticsLogs || []), `[${new Date().toLocaleTimeString()}] Merge failed: ${err.message}`]
        } : u))
      }));
      toast.error(`Merge error: ${upload.file.name}`);
      get().processQueue(onUploadSuccess);
    }
  }
}));
