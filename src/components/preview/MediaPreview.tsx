"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  VolumeXIcon,
  Maximize2Icon,
  MusicIcon,
} from "lucide-react";

interface MediaPreviewProps {
  url: string;
  mimeType: string;
}

function formatTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds().toString().padStart(2, "0");
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export default function MediaPreview({ url, mimeType }: MediaPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAudio = mimeType.startsWith("audio/");

  // Sync media element properties
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
    el.playbackRate = playbackRate;
  }, [volume, muted, playbackRate]);

  const handlePlayPause = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
  }, [playing]);

  const handleTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (!el || seeking) return;
    setCurrentTime(el.currentTime);
  }, [seeking]);

  const handleDurationLoaded = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    setDuration(el.duration);
  }, []);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    setSeeking(true);
  };

  const handleSeekCommit = (e: React.MouseEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
    }
    setSeeking(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setMuted(vol === 0);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const played = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      ref={containerRef}
      className="w-full max-w-4xl mx-auto flex flex-col bg-[#070714] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.15)] relative"
    >
      {/* Media Canvas */}
      <div className="w-full relative flex items-center justify-center bg-black/80 overflow-hidden">
        {isAudio ? (
          <div className="flex flex-col items-center gap-6 text-center select-none p-10">
            <div className="w-20 h-20 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5 text-primary shadow-[0_0_20px_rgba(139,92,246,0.1)] relative">
              <MusicIcon className="w-8 h-8 z-10" />
              {playing && (
                <span className="absolute inset-0 rounded-full border border-primary/60 animate-ping opacity-60" />
              )}
            </div>
            {/* Waveform animation */}
            <div className="flex items-end gap-1 h-12 w-48 justify-center">
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-t bg-gradient-to-t from-primary to-secondary"
                  style={{
                    height: playing ? `${20 + Math.abs(Math.sin(i * 0.6)) * 70}%` : "8px",
                    transition: `height ${0.15 + i * 0.02}s ease-in-out`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        {isAudio ? (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleDurationLoaded}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            preload="metadata"
          />
        ) : (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={url}
            className="w-full aspect-video object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleDurationLoaded}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            preload="metadata"
            playsInline
          />
        )}

        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 border-2 border-primary/50 border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-md flex flex-col gap-3 font-mono text-[11px] text-gray-300 select-none">
        {/* Timeline */}
        <div className="flex items-center gap-3 w-full">
          <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit as any}
            className="flex-1 h-1.5 rounded bg-white/10 appearance-none cursor-pointer accent-primary focus:outline-none"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${played * 100}%, rgba(255,255,255,0.1) ${played * 100}%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <span className="w-10 tabular-nums">{formatTime(duration)}</span>
        </div>

        {/* Action row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="p-2.5 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/50 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all active:scale-95"
            >
              {playing ? (
                <PauseIcon className="w-4 h-4 fill-white" />
              ) : (
                <PlayIcon className="w-4 h-4 fill-white translate-x-[1px]" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMuted(!muted)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {muted || volume === 0 ? (
                  <VolumeXIcon className="w-4 h-4" />
                ) : (
                  <Volume2Icon className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 rounded bg-white/10 appearance-none cursor-pointer accent-secondary focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Speed */}
            <div className="flex items-center bg-white/5 rounded border border-white/10 p-0.5">
              {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    if (mediaRef.current) mediaRef.current.playbackRate = rate;
                  }}
                  className={`px-2 py-1 rounded text-[10px] transition-all ${
                    playbackRate === rate
                      ? "bg-secondary/20 text-secondary border border-secondary/30 font-bold"
                      : "text-gray-400 border border-transparent hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {!isAudio && (
              <button
                onClick={handleFullscreen}
                className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 transition-all"
                title="Fullscreen"
              >
                <Maximize2Icon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
