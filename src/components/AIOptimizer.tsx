"use client";
import { useEffect, useState } from "react";
import { BrainCircuitIcon, SparklesIcon, Trash2Icon, ArchiveIcon, ZapIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

interface Suggestion {
  id: string;
  type: "duplicate" | "archive" | "zap";
  title: string;
  spaceSaved: string;
  description: string;
  actionText: string;
  payload: Record<string, any>;
  jobId?: string;
  progress?: number;
}

export default function AIOptimizer() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch("/api/ai/optimize");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Failed to load optimization recommendations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleAction = async (suggestion: Suggestion) => {
    setActingOn(suggestion.id);
    try {
      const res = await fetch("/api/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suggestion.payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger optimization action");

      if (data.jobId) {
        // Enqueued background job
        toast.success("Background analysis scheduled");
        setSuggestions(prev => 
          prev.map(s => s.id === suggestion.id ? { ...s, jobId: data.jobId, progress: 0 } : s)
        );
        pollJobProgress(data.jobId, suggestion.id);
      } else {
        // Complete instant action
        toast.success(data.message || "Optimization executed");
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        setActingOn(null);
        // Trigger global file list reload if we deleted a file/folder
        try {
          const { useFileStore } = require("@/store/useFileStore");
          useFileStore.getState().fetchData();
        } catch (e) {}
      }
    } catch (err: any) {
      toast.error(err.message || "System error during execution");
      setActingOn(null);
    }
  };

  const pollJobProgress = (jobId: string, suggestionId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs?id=${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const status = data.job?.status;
        const progress = data.job?.progress || 0;

        if (status === "completed") {
          clearInterval(interval);
          toast.success("AI Summarization completed successfully");
          setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
          setActingOn(null);
          // Reload files list
          try {
            const { useFileStore } = require("@/store/useFileStore");
            useFileStore.getState().fetchData();
          } catch (e) {}
        } else if (status === "failed") {
          clearInterval(interval);
          toast.error(data.job?.error || "Background job failed");
          setSuggestions(prev => 
            prev.map(s => s.id === suggestionId ? { ...s, jobId: undefined, progress: undefined } : s)
          );
          setActingOn(null);
        } else {
          setSuggestions(prev => 
            prev.map(s => s.id === suggestionId ? { ...s, progress } : s)
          );
        }
      } catch (err) {
        clearInterval(interval);
        console.error("Error polling job status:", err);
        setActingOn(null);
      }
    }, 1000);
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-primary/20 relative overflow-hidden h-full flex flex-col items-center justify-center min-h-[250px]">
        <BrainCircuitIcon className="w-10 h-10 text-primary animate-pulse mb-4" />
        <p className="text-primary font-mono tracking-widest animate-pulse text-sm">NEURAL NET SCANNING STORAGE...</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-green-500/20 relative overflow-hidden flex items-center justify-center h-full min-h-[250px]">
        <div className="text-center">
          <SparklesIcon className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-green-400 font-bold tracking-widest font-mono">SYSTEM OPTIMIZED</p>
          <p className="text-xs text-gray-400 font-mono mt-1">No AI recommendations at this time.</p>
        </div>
      </div>
    );
  }

  const getIcon = (type: string) => {
    if (type === "duplicate") return <Trash2Icon className="w-5 h-5" />;
    if (type === "archive") return <ArchiveIcon className="w-5 h-5" />;
    return <ZapIcon className="w-5 h-5" />;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-primary/30 relative overflow-hidden h-full flex flex-col min-h-[300px]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>
      
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-mono">
        <BrainCircuitIcon className="w-5 h-5 text-primary" />
        <span className="neon-text">AI OPTIMIZER</span>
      </h3>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        <AnimatePresence>
          {suggestions.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-black/40 border border-white/5 rounded-xl p-4 group hover:border-primary/50 transition-colors relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary opacity-50 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-2 pl-2">
                <div className="flex items-center gap-2">
                  <div className="text-primary">{getIcon(s.type)}</div>
                  <h4 className="font-bold text-sm text-white font-mono">{s.title}</h4>
                </div>
                <span className="text-xs font-mono text-secondary px-2 py-0.5 rounded bg-secondary/10 border border-secondary/20 whitespace-nowrap ml-2">
                  Save {s.spaceSaved}
                </span>
              </div>
              
              <p className="text-xs text-gray-400 font-mono mb-3 pl-2 leading-relaxed">
                {s.description}
              </p>

              {s.progress !== undefined && (
                <div className="w-full bg-white/5 rounded-full h-1.5 mb-3 overflow-hidden border border-white/5">
                  <div 
                    className="bg-primary h-full transition-all duration-300 neon-shadow" 
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              )}

              <button
                onClick={() => handleAction(s)}
                disabled={actingOn === s.id}
                className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-mono uppercase"
              >
                {actingOn === s.id ? (
                  <BrainCircuitIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <SparklesIcon className="w-4 h-4" />
                )}
                {s.progress !== undefined 
                  ? `RUNNING (${s.progress}%)` 
                  : actingOn === s.id 
                    ? "EXECUTING..." 
                    : s.actionText
                }
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
