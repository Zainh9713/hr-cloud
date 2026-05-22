"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XIcon,
  DownloadIcon,
  BrainCircuitIcon,
  HistoryIcon,
  RotateCcwIcon,
  TrashIcon,
  InfoIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import dynamic from "next/dynamic";

// ─── PREVIEW TYPE RESOLVER ────────────────────────────────────────────────────
type PreviewType =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "markdown"
  | "docx"
  | "spreadsheet"
  | "office"
  | "archive"
  | "fallback";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv", "ogv"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "aac", "flac", "m4a"]);
const CODE_EXTS = new Set(["js", "jsx", "ts", "tsx", "html", "css", "py", "java", "cpp", "cc", "h", "c", "json", "xml", "yaml", "yml", "sql", "sh", "bash", "rb", "php", "go", "rs", "swift", "kt"]);
const TEXT_EXTS = new Set(["txt", "log", "ini", "env", "cfg", "conf"]);

function getPreviewType(mimeType: string, filename: string): PreviewType {
  const mime = (mimeType || "").toLowerCase();
  const ext = (filename.split(".").pop() || "").toLowerCase();

  if (mime === "application/pdf" || ext === "pdf") return "pdf";

  if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) return "image";

  if (mime.startsWith("video/") || VIDEO_EXTS.has(ext)) return "video";

  if (mime.startsWith("audio/") || AUDIO_EXTS.has(ext)) return "audio";

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    ext === "docx" || ext === "doc"
  ) return "docx";

  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "text/csv" ||
    ext === "xlsx" || ext === "xls" || ext === "csv"
  ) return "spreadsheet";

  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-powerpoint" ||
    ext === "pptx" || ext === "ppt"
  ) return "office";

  if (ext === "md" || mime === "text/markdown") return "markdown";

  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z") || mime.includes("tar") ||
      ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz") return "archive";

  if (
    mime.startsWith("text/") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("json") ||
    CODE_EXTS.has(ext) ||
    TEXT_EXTS.has(ext)
  ) return "code";

  return "fallback";
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── DYNAMIC CLIENT-ONLY PREVIEW COMPONENTS ──────────────────────────────────
// ALL use ssr: false to prevent hydration mismatches and browser-API crashes
const ImagePreview = dynamic(() => import("./preview/ImagePreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="DECODING PIXEL MATRIX..." />,
});

const PDFPreview = dynamic(() => import("./preview/PDFPreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="BOOTING NEURAL PDF DECODER..." />,
});

const MediaPreview = dynamic(() => import("./preview/MediaPreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="CONNECTING STREAM FEED..." />,
});

const DocumentPreview = dynamic(() => import("./preview/DocumentPreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="CONVERTING DOCX FORMAT SECTOR..." />,
});

const SpreadsheetPreview = dynamic(() => import("./preview/SpreadsheetPreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="PARSING MATRIX CELLS..." />,
});

const OfficePreview = dynamic(() => import("./preview/OfficePreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="EMBEDDING CLOUD STREAM VIEWER..." />,
});

const MarkdownPreview = dynamic(() => import("./preview/MarkdownPreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="FORMATTING MARKDOWN SCRIPT..." />,
});

const ArchivePreview = dynamic(() => import("./preview/ArchivePreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="MAPPING VIRTUAL COMPRESSION TREE..." />,
});

const CodePreview = dynamic(() => import("./preview/CodePreview"), {
  ssr: false,
  loading: () => <PreviewLoader text="INITIATING MONACO READER MATRIX..." />,
});
// ─────────────────────────────────────────────────────────────────────────────

function PreviewLoader({ text }: { text: string }) {
  return (
    <div className="w-full flex flex-col items-center justify-center gap-3 py-16 font-mono">
      <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
      <p className="text-primary text-xs animate-pulse tracking-wider">{text}</p>
    </div>
  );
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface FilePreviewModalProps {
  file: any | null;
  onClose: () => void;
}

type TabType = "info" | "ai" | "versions";
// ─────────────────────────────────────────────────────────────────────────────

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [activeFile, setActiveFile] = useState<any | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("info");

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "model"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Sync file into local state ──────────────────────────────────────────────
  useEffect(() => {
    if (file) {
      setActiveFile(file);
      setTextContent(null);
      setSummary(file.aiSummary || null);
      setChatMessages([]);
      setActiveTab("info");

      if (file.aiSummary) {
        setChatMessages([
          {
            role: "model",
            content: `[NEURAL CORE] Telemetry established. File "${file.originalName}" indexed.\n\nSummary: "${file.aiSummary}"\n\nAsk me anything about this file.`,
          },
        ]);
      }
    }
  }, [file]);

  // ── ESC key close ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (file) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [file, onClose]);

  // ── Auto-scroll chat ────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Preview URL ─────────────────────────────────────────────────────────────
  const getOwnerIdString = (fileObj: any): string => {
    if (!fileObj?.ownerId) return "";
    return typeof fileObj.ownerId === "object"
      ? fileObj.ownerId._id || fileObj.ownerId.toString()
      : fileObj.ownerId;
  };

  const ownerId = activeFile ? getOwnerIdString(activeFile) : "";
  const previewUrl = activeFile ? `/storage/${ownerId}/${encodeURIComponent(activeFile.storedName)}` : "";

  // ── Determine preview type ──────────────────────────────────────────────────
  const previewType: PreviewType = activeFile
    ? getPreviewType(activeFile.mimeType || "", activeFile.originalName || "")
    : "fallback";

  // ── Fetch text content for code/markdown ───────────────────────────────────
  const isTextType = previewType === "code" || previewType === "markdown";

  useEffect(() => {
    if (!activeFile || !isTextType || textContent !== null || !previewUrl) return;

    fetch(previewUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(setTextContent)
      .catch((err) => {
        console.error("[FilePreviewModal] Text fetch error:", err);
        setTextContent(`// Error loading file: ${err.message}`);
      });
  }, [activeFile, isTextType, textContent, previewUrl]);

  if (!activeFile) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/files/download-token?fileId=${activeFile._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(`/api/files/download?token=${data.token}`, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve download key");
    }
  };

  const handleDownloadVersion = async (versionNumber: number) => {
    try {
      const res = await fetch(`/api/files/download-token?fileId=${activeFile._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(`/api/files/download?token=${data.token}&version=${versionNumber}`, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to retrieve download key");
    }
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: activeFile._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data.summary);
      setChatMessages([
        {
          role: "model",
          content: `[NEURAL CORE] Telemetry established. File "${activeFile.originalName}" indexed.\n\nSummary: "${data.summary}"\n\nAsk me anything about this file.`,
        },
      ]);
      try {
        const { useFileStore } = await import("@/store/useFileStore");
        useFileStore.getState().fetchData();
      } catch {}
      toast.success("AI Analysis Complete");
    } catch (err: any) {
      toast.error(err.message || "Failed to summarize");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isSending) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsSending(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userMsg }],
          fileId: activeFile._id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChatMessages((prev) => [...prev, { role: "model", content: data.message }]);
    } catch (err: any) {
      toast.error(err.message || "Neural Core link failed");
    } finally {
      setIsSending(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    if (!confirm(`Promote Version V${versionNumber} to active?`)) return;
    try {
      const res = await fetch("/api/files/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: activeFile._id, versionNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveFile(data.file);
      setTextContent(null);
      toast.success(`Promoted to V${versionNumber}`);
      try {
        const { useFileStore } = await import("@/store/useFileStore");
        useFileStore.getState().fetchData();
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Failed to restore version");
    }
  };

  const handleDeleteVersion = async (versionNumber: number) => {
    if (!confirm(`Permanently purge Version V${versionNumber}?`)) return;
    try {
      const res = await fetch(`/api/files/versions?fileId=${activeFile._id}&versionNumber=${versionNumber}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveFile(data.file);
      toast.success(`Deleted V${versionNumber}`);
      try {
        const { useFileStore } = await import("@/store/useFileStore");
        useFileStore.getState().fetchData();
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Failed to delete version");
    }
  };

  // ── Preview renderer ────────────────────────────────────────────────────────
  const renderPreview = () => {
    switch (previewType) {
      case "pdf":
        return <PDFPreview url={previewUrl} />;

      case "image":
        return <ImagePreview url={previewUrl} filename={activeFile.originalName} />;

      case "video":
      case "audio":
        return <MediaPreview url={previewUrl} mimeType={activeFile.mimeType} />;

      case "docx":
        return <DocumentPreview url={previewUrl} />;

      case "spreadsheet":
        return <SpreadsheetPreview url={previewUrl} />;

      case "office":
        return (
          <OfficePreview
            userId={ownerId}
            filename={activeFile.storedName}
            originalName={activeFile.originalName}
            mimeType={activeFile.mimeType}
            size={activeFile.size}
            onDownload={handleDownload}
          />
        );

      case "markdown":
        return <MarkdownPreview content={textContent || "RETRIEVING DATA SECTORS..."} />;

      case "archive":
        return (
          <ArchivePreview
            filename={activeFile.originalName}
            size={activeFile.size}
            onDownload={handleDownload}
          />
        );

      case "code":
        return (
          <CodePreview
            content={textContent ?? ""}
            filename={activeFile.originalName}
          />
        );

      default:
        return (
          <div className="w-full max-w-sm mx-auto flex flex-col bg-[#070714] border border-white/10 rounded-2xl p-6 font-mono text-xs text-gray-300 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                📁
              </div>
              <p className="text-gray-400 text-[11px]">Preview not available for this file type.</p>
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-left text-[10px] space-y-1">
                <div>NAME: <span className="text-white">{activeFile.originalName}</span></div>
                <div className="truncate">TYPE: <span className="text-white">{activeFile.mimeType}</span></div>
                <div>SIZE: <span className="text-white">{(activeFile.size / 1024).toFixed(1)} KB</span></div>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-1.5 px-4 py-2 w-full rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/50 transition-all font-bold tracking-widest uppercase text-[10px]"
              >
                <DownloadIcon className="w-4 h-4" />
                DOWNLOAD FILE SECTOR
              </button>
            </div>
          </div>
        );
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {file && activeFile && (
        <motion.div
          key="preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={onClose}
        >
        {/* Modal panel — stop clicks from reaching backdrop */}
          <motion.div
            key="preview-panel"
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-[95vw] h-[95vh] max-w-7xl bg-[#111827] rounded-2xl overflow-hidden flex flex-col shadow-[0_0_60px_rgba(139,92,246,0.3)] relative"
            onClick={(e) => e.stopPropagation()}
          >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 shrink-0" style={{ zIndex: 10001, position: "relative" }}>
            <h3 className="text-sm font-bold text-white truncate pr-4 font-mono flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse shrink-0" />
              <span className="truncate">{activeFile.originalName}</span>
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownload}
                className="p-2 text-gray-400 hover:text-secondary transition-colors rounded hover:bg-white/10"
                title="Download"
                style={{ position: "relative", zIndex: 10002, pointerEvents: "auto" }}
              >
                <DownloadIcon className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                title="Close (ESC)"
                aria-label="Close preview"
                style={{ position: "relative", zIndex: 10002, pointerEvents: "auto" }}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {/* Left: Preview Canvas */}
            <div
              className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-black border-r border-white/10"
            >
              {renderPreview()}
            </div>

            {/* Right: Tabbed Sidebar */}
            <div
              className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 border-white/10 bg-[#0a0a18] flex flex-col"
              style={{ minHeight: 0 }}
            >
              {/* Tab headers */}
              <div className="flex border-b border-white/10 bg-white/5 shrink-0" style={{ position: "relative", zIndex: 10001 }}>
                {(["info", "ai", "versions"] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{ pointerEvents: "auto", position: "relative", zIndex: 10001 }}
                    className={`flex-1 py-3 text-[10px] font-bold font-mono tracking-widest uppercase border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === tab
                        ? "text-primary border-primary bg-primary/5"
                        : "text-gray-400 border-transparent hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {tab === "info" && <InfoIcon className="w-3.5 h-3.5" />}
                    {tab === "ai" && <BrainCircuitIcon className="w-3.5 h-3.5" />}
                    {tab === "versions" && <HistoryIcon className="w-3.5 h-3.5" />}
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
                style={{
                  minHeight: 0,
                  scrollbarWidth: "thin",
                  scrollbarColor: "#4c1d95 transparent",
                }}
              >
                {/* ── INFO TAB ── */}
                {activeTab === "info" && (
                  <div className="space-y-4 font-mono text-xs">
                    <h4 className="text-[10px] text-secondary uppercase tracking-widest font-semibold flex items-center gap-1.5 border-b border-white/5 pb-2">
                      METADATA REPORT
                    </h4>
                    <div className="space-y-3 bg-black/40 p-4 border border-white/5 rounded-xl">
                      {[
                        ["ORIGINAL NAME", activeFile.originalName],
                        ["MIME TYPE", activeFile.mimeType],
                        ["FILE SIZE", `${(activeFile.size / 1024).toFixed(1)} KB (${(activeFile.size / 1024 / 1024).toFixed(2)} MB)`],
                        ["PREVIEW TYPE", previewType.toUpperCase()],
                        ["SHA256 HASH", activeFile.hash || "NOT COMPUTED"],
                        ["INDEX DATE", format(new Date(activeFile.createdAt), "yyyy-MM-dd HH:mm:ss")],
                        ["LAST MODIFIED", format(new Date(activeFile.updatedAt || activeFile.createdAt), "yyyy-MM-dd HH:mm:ss")],
                      ].map(([label, value], i) => (
                        <div key={i} className={`flex flex-col gap-1 ${i > 0 ? "border-t border-white/5 pt-2" : ""}`}>
                          <span className="text-gray-500 text-[10px]">{label}</span>
                          <span className={`text-white break-all ${label === "SHA256 HASH" ? "text-[10px] text-gray-400 select-all font-sans" : "truncate"}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── AI TAB ── */}
                {activeTab === "ai" && (
                  <div className="flex flex-col gap-4 overflow-hidden" style={{ minHeight: 0 }}>
                    {!summary ? (
                      <button
                        onClick={handleSummarize}
                        disabled={isSummarizing}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 transition-all font-bold tracking-widest uppercase disabled:opacity-50 font-mono text-[10px] mt-2"
                        style={{ pointerEvents: "auto" }}
                      >
                        <SparklesIcon className={`w-4 h-4 ${isSummarizing ? "animate-spin" : ""}`} />
                        {isSummarizing ? "COMPUTING SYSTOLIC INDICES..." : "ACTIVATE NEURAL SUMMARIZATION"}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
                        {/* Summary block */}
                        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/30 relative overflow-hidden shrink-0">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-secondary" />
                          <h4 className="text-[10px] font-mono text-primary mb-1 uppercase tracking-widest font-semibold">
                            NEURAL INDEX SUMMARY
                          </h4>
                          <p className="text-[11px] text-gray-300 leading-relaxed font-sans">{summary}</p>
                          {activeFile.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2.5">
                              {activeFile.tags.map((tag: string, i: number) => (
                                <span key={i} className="text-[9px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-secondary font-bold">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Chat */}
                        <div className="flex-1 flex flex-col bg-black/40 border border-white/5 rounded-xl overflow-hidden font-mono text-xs" style={{ minHeight: 0 }}>
                          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5" style={{ scrollbarWidth: "thin", scrollbarColor: "#4c1d95 transparent" }}>
                            {chatMessages.map((msg, i) => (
                              <div key={i} className={`flex flex-col gap-1 max-w-[88%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                                <span className="text-[8px] text-gray-500 uppercase">
                                  {msg.role === "user" ? "CLIENT" : "NEURAL CORE"}
                                </span>
                                <div className={`p-2.5 rounded-xl text-[10.5px] leading-normal font-sans break-words whitespace-pre-wrap ${
                                  msg.role === "user"
                                    ? "bg-primary/20 text-white rounded-tr-none border border-primary/30"
                                    : "bg-white/5 text-gray-300 rounded-tl-none border border-white/5"
                                }`}>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            {isSending && (
                              <div className="mr-auto flex flex-col gap-1">
                                <span className="text-[8px] text-primary animate-pulse uppercase">NEURAL NET WORKING</span>
                                <div className="p-2.5 rounded-xl text-[10px] bg-white/5 text-primary border border-primary/20 rounded-tl-none animate-pulse">
                                  DECRYPTING QUERY...
                                </div>
                              </div>
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          <form
                            onSubmit={(e) => { e.preventDefault(); handleSendChat(); }}
                            className="p-2 border-t border-white/10 bg-white/5 flex gap-2 shrink-0"
                          >
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="Query neural network about file..."
                              className="flex-1 bg-black/50 border border-white/10 rounded px-2.5 py-1.5 text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 text-[10px]"
                            />
                            <button
                              type="submit"
                              disabled={isSending || !chatInput.trim()}
                              className="p-1.5 rounded bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30 disabled:opacity-30 disabled:pointer-events-none transition-all"
                              style={{ pointerEvents: "auto" }}
                            >
                              <SendIcon className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── VERSIONS TAB ── */}
                {activeTab === "versions" && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono text-secondary uppercase tracking-widest font-semibold flex items-center gap-1.5 border-b border-white/5 pb-2">
                      VERSION ARCHIVE INTEGRITY
                    </h4>
                    <div className="space-y-3">
                      {/* Active version */}
                      <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl relative font-mono text-xs">
                        <div className="absolute top-2.5 right-2.5 text-[8px] font-mono text-primary bg-primary/20 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold animate-pulse">
                          Active
                        </div>
                        <p className="text-xs text-white font-bold">V{(activeFile.versionHistory?.length || 0) + 1}</p>
                        <p className="text-[9px] text-gray-400 mt-1">
                          {format(new Date(activeFile.updatedAt || activeFile.createdAt), "yyyy-MM-dd HH:mm:ss")}
                        </p>
                        <p className="text-[9px] text-gray-500">{(activeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>

                      {activeFile.versionHistory?.length > 0 ? (
                        [...activeFile.versionHistory].reverse().map((version: any) => (
                          <div
                            key={version.version}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl flex flex-col gap-2 group transition-all font-mono text-xs"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs text-white font-bold">V{version.version}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">
                                  {format(new Date(version.createdAt), "yyyy-MM-dd HH:mm:ss")}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleDownloadVersion(version.version)}
                                  className="p-1 text-gray-400 hover:text-secondary hover:bg-white/10 rounded transition-all"
                                  title="Download version"
                                  style={{ pointerEvents: "auto" }}
                                >
                                  <DownloadIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRestore(version.version)}
                                  className="p-1 text-gray-400 hover:text-primary hover:bg-white/10 rounded transition-all"
                                  title="Restore version"
                                  style={{ pointerEvents: "auto" }}
                                >
                                  <RotateCcwIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteVersion(version.version)}
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded transition-all"
                                  title="Delete version"
                                  style={{ pointerEvents: "auto" }}
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="text-[8px] text-gray-500 flex flex-col gap-0.5 border-t border-white/5 pt-1.5">
                              <span className="truncate">OWNER: {version.uploadedBy || "System User"}</span>
                              <span>SIZE: {(version.size / 1024 / 1024).toFixed(2)} MB</span>
                              <span className="truncate">MIME: {version.mimeType || "Binary"}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-4 border border-white/5 rounded-xl bg-black/20 text-gray-500 font-mono text-[10px]">
                          No legacy snapshot sectors archived.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
