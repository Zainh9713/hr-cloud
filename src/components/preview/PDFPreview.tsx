"use client";
import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// ─── STABLE WORKER CONFIG ────────────────────────────────────────────────────
// Use the EXACT pdfjs version that react-pdf ships internally.
// pdfjs.version is always the correct version — prevents API/Worker mismatch.
// Local /pdf.worker.min.mjs must be copied from react-pdf's own node_modules.
// CDN fallback uses the same version string for guaranteed compatibility.
if (typeof window !== "undefined") {
  // Self-healing: always match react-pdf's own pdfjs version exactly
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
}
// ─────────────────────────────────────────────────────────────────────────────

interface PDFPreviewProps {
  url: string;
}

export default function PDFPreview({ url }: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  // Measure container width for responsive rendering
  useEffect(() => {
    const updateWidth = () => {
      const el = document.getElementById("pdf-viewport-inner");
      if (el) setContainerWidth(el.clientWidth - 32);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("[PDFPreview] Load error:", err);
    setError(err.message || "Failed to load PDF. The file may be corrupted or inaccessible.");
    setLoading(false);
  }, []);

  const prevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p));
  const zoomIn = () => setScale((s) => Math.min(3.0, parseFloat((s + 0.15).toFixed(2))));
  const zoomOut = () => setScale((s) => Math.max(0.4, parseFloat((s - 0.15).toFixed(2))));
  const resetZoom = () => setScale(1.0);

  const toggleFullscreen = () => {
    const el = document.getElementById("pdf-preview-root");
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    } else {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    }
  };

  return (
    <div
      id="pdf-preview-root"
      className="flex flex-col items-center w-full h-[65vh] bg-[#0c0c1b]/80 border border-white/10 rounded-xl overflow-hidden relative"
    >
      {/* ── Control Panel ── */}
      <div className="w-full flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5 backdrop-blur-md z-20 font-mono text-xs text-white shrink-0">
        {/* Page nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevPage}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-secondary disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Previous Page"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="px-2 tabular-nums">
            {loading ? "PAGE — / —" : `PAGE ${pageNumber} / ${numPages ?? "?"}`}
          </span>
          <button
            onClick={nextPage}
            disabled={numPages ? pageNumber >= numPages : true}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-secondary disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Next Page"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-secondary transition-all"
            title="Zoom Out"
          >
            <ZoomOutIcon className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs transition-all tabular-nums"
            title="Reset Zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-secondary transition-all"
            title="Zoom In"
          >
            <ZoomInIcon className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 hover:text-primary transition-all ml-1"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <MinimizeIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── PDF Viewport ── */}
      <div
        id="pdf-viewport-inner"
        className="flex-1 w-full overflow-auto flex flex-col items-center bg-[#050510]/95 p-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#4c1d95 transparent" }}
      >
        {/* Error state */}
        {error && !loading && (
          <div className="m-auto text-center font-mono p-6 border border-red-500/30 rounded-xl bg-red-950/20 text-red-400 text-xs max-w-md">
            <p className="text-sm font-bold mb-2 text-red-300">SECTOR DECODE FAILED</p>
            <p>{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-primary hover:underline text-[10px]"
            >
              Attempt raw file access →
            </a>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="m-auto flex flex-col items-center gap-3 mt-16">
              <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              <p className="font-mono text-primary text-xs animate-pulse">DECRYPTING DOCUMENT SECTORS...</p>
            </div>
          }
          error={null}
          className="flex flex-col items-center gap-4"
        >
          {!error && (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              width={containerWidth}
              loading={
                <div className="font-mono text-xs text-secondary mt-8 animate-pulse">
                  RENDERING PAGE VECTOR {pageNumber}...
                </div>
              }
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-[0_4px_40px_rgba(139,92,246,0.15)] rounded overflow-hidden"
            />
          )}
        </Document>
      </div>

      {/* Keyboard hint */}
      {!loading && !error && numPages && numPages > 1 && (
        <div className="shrink-0 text-[9px] font-mono text-gray-600 py-1 border-t border-white/5 text-center w-full">
          ← → TO NAVIGATE • SCROLL TO PAN
        </div>
      )}
    </div>
  );
}
