import { create } from "zustand";
import { toast } from "react-hot-toast";

interface FileItem {
  _id: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string;
  parentFolderId: string | null;
  isStarred: boolean;
  updatedAt: string;
  tags: string[];
}

interface FolderItem {
  _id: string;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  isStarred: boolean;
  updatedAt: string;
}

interface FileState {
  files: FileItem[];
  folders: FolderItem[];
  allFolders: FolderItem[]; // For FolderTree sidebar
  currentFolderId: string | null;
  folderPath: { id: string | null; name: string }[];
  loading: boolean;
  error: string | null;

  // Pagination states
  filesPage: number;
  foldersPage: number;
  filesTotal: number;
  foldersTotal: number;
  hasMoreFiles: boolean;
  hasMoreFolders: boolean;

  setCurrentFolderId: (id: string | null) => void;
  setFolderPath: (path: { id: string | null; name: string }[]) => void;
  fetchData: (folderId?: string | null, reset?: boolean) => Promise<void>;
  fetchMoreFiles: () => Promise<void>;
  fetchMoreFolders: () => Promise<void>;
  fetchAllFolders: () => Promise<void>;
  navigateToFolder: (folderId: string | null, folderName: string) => void;
  syncFolderContext: (folderId: string | null) => Promise<void>;
  
  createFolder: (name: string, parentId: string | null, color?: string, icon?: string) => Promise<void>;
  deleteItem: (id: string, type: "file" | "folder") => Promise<void>;
  renameItem: (id: string, type: "file" | "folder", newName: string) => Promise<void>;
  moveItem: (id: string, type: "file" | "folder", targetParentId: string | null) => Promise<void>;
  updateFolderMetadata: (id: string, updates: Partial<FolderItem>) => Promise<void>;
  updateFileMetadata: (id: string, updates: Partial<FileItem>) => Promise<void>;
}

const PAGE_SIZE = 50;

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  folders: [],
  allFolders: [],
  currentFolderId: null,
  folderPath: [{ id: null, name: "ROOT" }],
  loading: false,
  error: null,

  filesPage: 1,
  foldersPage: 1,
  filesTotal: 0,
  foldersTotal: 0,
  hasMoreFiles: false,
  hasMoreFolders: false,

  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setFolderPath: (path) => set({ folderPath: path }),

  fetchData: async (folderId = get().currentFolderId, reset = true) => {
    if (reset) {
      set({
        filesPage: 1,
        foldersPage: 1,
        files: [],
        folders: [],
        hasMoreFiles: false,
        hasMoreFolders: false,
        filesTotal: 0,
        foldersTotal: 0
      });
    }
    set({ loading: true, error: null });
    try {
      const urlSuffix = folderId ? `&parentId=${folderId}` : "";
      const filesUrlSuffix = folderId ? `&folderId=${folderId}` : "";
      
      const [filesRes, foldersRes] = await Promise.all([
        fetch(`/api/files?page=1&limit=${PAGE_SIZE}${filesUrlSuffix}`),
        fetch(`/api/folders?page=1&limit=${PAGE_SIZE}${urlSuffix}`)
      ]);

      const filesData = await filesRes.json();
      const foldersData = await foldersRes.json();

      if (!filesRes.ok) throw new Error(filesData.error || "Failed to load files");
      if (!foldersRes.ok) throw new Error(foldersData.error || "Failed to load folders");

      const fetchedFiles = filesData.files || [];
      const fetchedFolders = foldersData.folders || [];
      const filesTotal = filesData.totalCount ?? fetchedFiles.length;
      const foldersTotal = foldersData.totalCount ?? fetchedFolders.length;

      set({
        files: fetchedFiles,
        folders: fetchedFolders,
        filesTotal,
        foldersTotal,
        hasMoreFiles: fetchedFiles.length < filesTotal,
        hasMoreFolders: fetchedFolders.length < foldersTotal,
        loading: false
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      toast.error(err.message || "Failed to load grid data");
    }
  },

  fetchMoreFiles: async () => {
    const { currentFolderId, filesPage, files, filesTotal, hasMoreFiles, loading } = get();
    if (loading || !hasMoreFiles) return;

    set({ loading: true });
    try {
      const nextPage = filesPage + 1;
      const folderIdParam = currentFolderId ? `&folderId=${currentFolderId}` : "";
      const res = await fetch(`/api/files?page=${nextPage}&limit=${PAGE_SIZE}${folderIdParam}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load more files");

      const fetchedFiles = data.files || [];
      const updatedFiles = [...files, ...fetchedFiles];

      set({
        files: updatedFiles,
        filesPage: nextPage,
        hasMoreFiles: updatedFiles.length < (data.totalCount ?? filesTotal),
        loading: false
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      toast.error(err.message || "Failed to load more files");
    }
  },

  fetchMoreFolders: async () => {
    const { currentFolderId, foldersPage, folders, foldersTotal, hasMoreFolders, loading } = get();
    if (loading || !hasMoreFolders) return;

    set({ loading: true });
    try {
      const nextPage = foldersPage + 1;
      const parentIdParam = currentFolderId ? `&parentId=${currentFolderId}` : "";
      const res = await fetch(`/api/folders?page=${nextPage}&limit=${PAGE_SIZE}${parentIdParam}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load more folders");

      const fetchedFolders = data.folders || [];
      const updatedFolders = [...folders, ...fetchedFolders];

      set({
        folders: updatedFolders,
        foldersPage: nextPage,
        hasMoreFolders: updatedFolders.length < (data.totalCount ?? foldersTotal),
        loading: false
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      toast.error(err.message || "Failed to load more folders");
    }
  },

  fetchAllFolders: async () => {
    try {
      const res = await fetch("/api/folders?tree=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ allFolders: data.folders || [] });
    } catch (err: any) {
      console.error("Failed to load folder tree data:", err);
    }
  },

  navigateToFolder: (folderId, folderName) => {
    const { folderPath } = get();
    set({ currentFolderId: folderId });
    
    if (folderId === null) {
      set({ folderPath: [{ id: null, name: "ROOT" }] });
    } else {
      const existingIndex = folderPath.findIndex((f) => f.id === folderId);
      if (existingIndex >= 0) {
        set({ folderPath: folderPath.slice(0, existingIndex + 1) });
      } else {
        set({ folderPath: [...folderPath, { id: folderId, name: folderName }] });
      }
    }
    // Fetch data for the new folder
    get().fetchData(folderId);
  },

  syncFolderContext: async (folderId) => {
    let { allFolders } = get();
    if (allFolders.length === 0) {
      await get().fetchAllFolders();
      allFolders = get().allFolders;
    }

    set({ currentFolderId: folderId });

    if (folderId === null) {
      set({ folderPath: [{ id: null, name: "ROOT" }] });
      return;
    }

    const path: { id: string | null; name: string }[] = [];
    let currentId: string | null = folderId;
    let depth = 0;
    
    while (currentId && depth < 100) {
      const folder = allFolders.find((f) => f._id.toString() === currentId);
      if (!folder) break;
      path.unshift({ id: folder._id.toString(), name: folder.name });
      currentId = folder.parentId ? folder.parentId.toString() : null;
      depth++;
    }

    path.unshift({ id: null, name: "ROOT" });
    set({ folderPath: path });
  },

  createFolder: async (name, parentId, color, icon) => {
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId, color, icon })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create folder");
      }
      toast.success(`Sector folder "${name}" compiled successfully`);
      await get().fetchData();
      await get().fetchAllFolders();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  },

  deleteItem: async (id, type) => {
    try {
      const res = await fetch(`/api/${type}s?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to delete ${type}`);
      
      toast.success(`${type === "file" ? "File" : "Folder"} sent to recycler bin`);
      
      // Optimistic state updates
      if (type === "file") {
        set({ files: get().files.filter((f) => f._id !== id) });
      } else {
        set({ folders: get().folders.filter((f) => f._id !== id) });
        await get().fetchAllFolders();
      }
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  },

  renameItem: async (id, type, newName) => {
    try {
      const res = await fetch(`/api/${type}s/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, newName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to rename ${type}`);
      
      toast.success("Identity updated successfully");
      
      // Update local state
      if (type === "file") {
        set({
          files: get().files.map((f) => (f._id === id ? { ...f, originalName: newName } : f))
        });
      } else {
        set({
          folders: get().folders.map((f) => (f._id === id ? { ...f, name: newName } : f))
        });
        await get().fetchAllFolders();
      }
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  },

  moveItem: async (id, type, targetParentId) => {
    try {
      const endpoint = type === "file" ? "/api/files/move" : "/api/folders/move";
      const body: Record<string, any> = { id };
      if (type === "file") {
        body.folderId = targetParentId;
      } else {
        body.parentId = targetParentId;
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to move ${type}`);

      toast.success(`Successfully relocated ${type}`);
      
      // Refresh to ensure database state
      await get().fetchData();
      await get().fetchAllFolders();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  },

  updateFolderMetadata: async (id, updates) => {
    try {
      const res = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update folder metadata");

      toast.success("Folder customized successfully");
      
      await get().fetchData();
      await get().fetchAllFolders();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  },

  updateFileMetadata: async (id, updates) => {
    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update file metadata");

      toast.success("File metadata updated");
      await get().fetchData();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  }
}));
