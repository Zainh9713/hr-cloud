"use client";
import { useState, useEffect, useRef } from "react";
import { ZoomInIcon, ZoomOutIcon, RotateCcwIcon } from "lucide-react";

interface ImagePreviewProps {
  url: string;
  filename: string;
}

export default function ImagePreview({ url, filename }: ImagePreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoom(1);
  }, [url]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleReset = () => setZoom(1);

  if (error) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-[#0b0b0f] flex items-center justify-center">
        <div className="flex flex-col items-center justify-center max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="font-mono text-sm text-red-400 font-bold tracking-wider uppercase mb-2">Failed to load image sector</p>
          <p className="text-gray-500 text-xs mb-6">The image matrix could not be decoded or the stream was interrupted.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white hover:bg-white/10 hover:border-primary/50 transition-all uppercase tracking-wider"
          >
            Open raw URL
          </a>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0b0b0f]">
      
      {/* Loading Skeleton */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0f] z-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin shadow-[0_0_15px_rgba(139,92,246,0.3)]" />
            <p className="text-primary/70 font-mono text-[10px] uppercase tracking-[0.2em] animate-pulse">
              Decoding Image Matrix...
            </p>
          </div>
        </div>
      )}

      {/* Image Container - PERFECTLY CENTERED */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
          className={`
            max-w-full max-h-full object-contain select-none
            transition-transform duration-300 ease-out
            ${loaded ? "opacity-100" : "opacity-0"}
          `}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center'
          }}
          draggable={false}
        />
      </div>

      {/* Floating Controls */}
      {loaded && !error && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl z-30 shadow-xl">
          <button 
            onClick={handleZoomOut} 
            disabled={zoom <= 0.5}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOutIcon className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-mono font-bold text-gray-300 w-12 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={handleZoomIn} 
            disabled={zoom >= 4}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomInIcon className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/20 mx-1" />
          <button 
            onClick={handleReset} 
            disabled={zoom === 1}
            className="p-1.5 text-gray-400 hover:text-primary disabled:opacity-30 transition-colors"
          >
            <RotateCcwIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
