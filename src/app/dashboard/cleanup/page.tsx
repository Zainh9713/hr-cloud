"use client";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { CpuIcon, Trash2Icon, RefreshCwIcon, AlertTriangleIcon, CheckSquareIcon, CheckCircle2Icon } from "lucide-react";
import { format } from "date-fns";

interface DuplicateFile {
  _id: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  parentFolderId: string | null;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  totalSize: number;
  wastedSize: number;
  files: DuplicateFile[];
}

export default function AICleanupPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [purging, setPurging] = useState(false);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/cleanup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scan grid");
      setGroups(data.duplicateGroups || []);
      setSelectedFileIds([]); // Clear selection
    } catch (err: any) {
      toast.error(err.message || "Failed to scan sector duplicates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const totalWasted = groups.reduce((acc, g) => acc + g.wastedSize, 0);
  const totalDuplicates = groups.reduce((acc, g) => acc + (g.files.length - 1), 0);

  const toggleSelectFile = (fileId: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  // Keep Oldest: select all files in the group except the one with the earliest createdAt
  const autoSelectKeepOldest = () => {
    const toSelect: string[] = [];
    groups.forEach(g => {
      const sorted = [...g.files].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      // Keep first (oldest), check all others
      for (let i = 1; i < sorted.length; i++) {
        toSelect.push(sorted[i]._id);
      }
    });
    setSelectedFileIds(toSelect);
    toast.success("Auto-selected all redundant copies (keeping oldest versions)");
  };

  // Keep Newest: select all files in the group except the one with the latest createdAt
  const autoSelectKeepNewest = () => {
    const toSelect: string[] = [];
    groups.forEach(g => {
      const sorted = [...g.files].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      // Keep first (newest), check all others
      for (let i = 1; i < sorted.length; i++) {
        toSelect.push(sorted[i]._id);
      }
    });
    setSelectedFileIds(toSelect);
    toast.success("Auto-selected all redundant copies (keeping newest versions)");
  };

  const handlePurgeSelected = async () => {
    if (selectedFileIds.length === 0) return;
    if (!confirm(`Purge all ${selectedFileIds.length} checked duplicate copies to the Recycler Bin?`)) return;

    setPurging(true);
    let success = 0;
    let failed = 0;

    for (const id of selectedFileIds) {
      try {
        const res = await fetch(`/api/files?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          success++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
    }

    setPurging(false);
    if (failed > 0) {
      toast.error(`Purged ${success} duplicates. Failed to purge ${failed} duplicates.`);
    } else {
      toast.success(`Successfully purged ${success} duplicate files.`);
    }

    fetchDuplicates();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wider neon-text mb-2 flex items-center gap-3 uppercase">
            <CpuIcon className="w-8 h-8 text-primary" />
            AI Cleanup Assistant
          </h1>
          <p className="text-gray-400 font-mono">Scan grid sectors for redundant duplicate file groups and reclaim storage.</p>
        </div>
        <button
          onClick={fetchDuplicates}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono hover:bg-white/10 transition-all font-bold uppercase cursor-pointer"
        >
          <RefreshCwIcon className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
          Re-Scan Grid
        </button>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-primary/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50">
            <CpuIcon className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">DUPLICATE GROUPS FOUND</p>
            <p className="text-2xl font-bold text-white">{groups.length}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-red-500/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-950/20 flex items-center justify-center border border-red-500/50">
            <AlertTriangleIcon className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">REDUNDANT FILES</p>
            <p className="text-2xl font-bold text-white">{totalDuplicates}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-green-500/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-950/20 flex items-center justify-center border border-green-500/50">
            <CheckCircle2Icon className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">RECLAIMABLE SPACE</p>
            <p className="text-2xl font-bold text-green-400">
              {(totalWasted / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      </div>

      {/* Control Actions bar */}
      {groups.length > 0 && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={autoSelectKeepOldest}
              className="px-4 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer"
            >
              Keep Oldest Copies
            </button>
            <button
              onClick={autoSelectKeepNewest}
              className="px-4 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-secondary/30 bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all cursor-pointer"
            >
              Keep Newest Copies
            </button>
          </div>

          {selectedFileIds.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-mono text-white font-bold animate-pulse">
                {selectedFileIds.length} REDUNDANT FILES SELECTED
              </span>
              <button
                onClick={handlePurgeSelected}
                disabled={purging}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-mono text-sm font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer"
              >
                <Trash2Icon className="w-4 h-4" />
                {purging ? "PURGING..." : "Purge Checked Copies"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Duplicates Groups List */}
      <div className="space-y-6">
        {loading ? (
          <div className="glass-panel rounded-2xl border border-white/10 p-12 text-center text-primary animate-pulse font-mono">
            SCANNING ALL DIRECTORY SECTORS FOR DUPLICATE CHECKSUMS...
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-green-500/20 bg-green-950/5 p-12 text-center text-green-400 font-mono">
            GRID CLEAN. NO DUPLICATE SECTOR HASHES DETECTED.
          </div>
        ) : (
          groups.map(group => (
            <div 
              key={group.hash} 
              className="glass-panel border border-white/10 rounded-2xl overflow-hidden shadow-lg bg-[#070714]/80"
            >
              {/* Group Header */}
              <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-mono">MD5 HASH: {group.hash}</p>
                  <p className="text-sm font-mono text-white font-bold">
                    Size: {(group.size / 1024 / 1024).toFixed(2)} MB / Group Wastes:{" "}
                    <span className="text-red-400">{(group.wastedSize / 1024 / 1024).toFixed(2)} MB</span>
                  </p>
                </div>
                <div className="text-xs font-mono text-gray-400">
                  {group.files.length} duplicate copies
                </div>
              </div>

              {/* Group File List */}
              <div className="divide-y divide-white/5">
                {group.files.map(file => {
                  const isChecked = selectedFileIds.includes(file._id);
                  return (
                    <div 
                      key={file._id}
                      onClick={() => toggleSelectFile(file._id)}
                      className={`p-4 flex items-center justify-between gap-4 transition-all duration-150 cursor-pointer hover:bg-white/5 ${
                        isChecked ? "bg-red-500/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by outer click
                          className="accent-red-500 cursor-pointer w-4.5 h-4.5 rounded border-white/20 bg-black/40 focus:ring-0"
                        />
                        <div>
                          <p className="text-white font-medium hover:text-primary transition-colors font-mono">
                            {file.originalName}
                          </p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            Created: {format(new Date(file.createdAt), "yyyy-MM-dd HH:mm:ss")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isChecked ? (
                          <span className="text-red-400 text-xs font-mono font-bold uppercase tracking-wider bg-red-950/40 px-2.5 py-1 rounded border border-red-500/25">
                            MARKED TO PURGE
                          </span>
                        ) : (
                          <span className="text-green-400 text-xs font-mono font-bold uppercase tracking-wider bg-green-950/40 px-2.5 py-1 rounded border border-green-500/25">
                            KEEP
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
