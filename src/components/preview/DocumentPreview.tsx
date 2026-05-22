"use client";
import { useState, useEffect } from "react";

interface DocumentPreviewProps {
  url: string;
}

export default function DocumentPreview({ url }: DocumentPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDoc() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();

        // Dynamically import mammoth to keep it client-only
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (active) {
          setHtml(result.value || "<p style='color:#888;font-family:monospace'>Document sector is empty.</p>");
          setLoading(false);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to parse DOCX document.";
        console.error("[DocumentPreview] Error:", err);
        if (active) {
          setError(message);
          setLoading(false);
        }
      }
    }

    loadDoc();
    return () => { active = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-[65vh] flex items-center justify-center bg-[#070714] border border-white/10 rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <div className="font-mono text-primary text-xs animate-pulse">EXTRACTING DOCUMENT STRUCTS...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[65vh] flex items-center justify-center bg-[#070714] border border-white/10 rounded-xl">
        <div className="text-center font-mono p-6 border border-red-500/30 rounded-xl bg-red-950/20 text-red-400 text-xs max-w-md">
          <p className="text-sm font-bold mb-2 text-red-300">DOCX PARSE ERROR</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-[65vh] overflow-auto bg-white text-black p-8 rounded-xl shadow-2xl"
      style={{ scrollbarWidth: "thin" }}
    >
      <div
        className="document-content leading-relaxed max-w-3xl mx-auto text-sm"
        style={{ fontFamily: "Georgia, serif" }}
        dangerouslySetInnerHTML={{ __html: html || "" }}
      />
    </div>
  );
}
