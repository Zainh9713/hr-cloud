"use client";
import StorageChart from "@/components/StorageChart";
import FileUploadZone from "@/components/FileUploadZone";
import FileManager from "@/components/FileManager";
import AIOptimizer from "@/components/AIOptimizer";
import { ActivityIcon, DatabaseIcon, ShieldCheckIcon } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-wider neon-text mb-2">COMMAND CENTER</h1>
        <p className="text-gray-400 font-mono">Welcome back to the grid. Manage your encrypted data.</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-primary/30 flex items-center gap-4 group hover:bg-primary/5 transition-colors">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 group-hover:scale-110 transition-transform">
            <DatabaseIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">CORE SERVER</p>
            <p className="text-xl font-bold text-white">ONLINE</p>
          </div>
        </div>
        
        <div className="glass-panel p-6 rounded-2xl border border-secondary/30 flex items-center gap-4 group hover:bg-secondary/5 transition-colors md:col-span-2">
          <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/50 group-hover:scale-110 transition-transform">
            <ShieldCheckIcon className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">ENCRYPTION PROTOCOL</p>
            <p className="text-xl font-bold text-white">QUANTUM AES-256 ACTIVE</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-accent/30 flex items-center gap-4 group hover:bg-accent/5 transition-colors">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center border border-accent/50 group-hover:scale-110 transition-transform">
            <ActivityIcon className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">NETWORK TRACE</p>
            <p className="text-xl font-bold text-white animate-pulse">SECURE</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <FileManager />
        </div>
        <div className="space-y-8">
          <StorageChart />
          <AIOptimizer />
          <FileUploadZone />
        </div>
      </div>
    </div>
  );
}
