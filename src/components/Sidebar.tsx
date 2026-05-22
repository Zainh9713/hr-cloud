"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderIcon, HardDriveIcon, HomeIcon, SettingsIcon, UploadCloudIcon, Trash2Icon, StarIcon, ClockIcon, Share2Icon, SparklesIcon, CpuIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { name: "Files", href: "/dashboard/files", icon: FolderIcon },
  { name: "Starred", href: "/dashboard/starred", icon: StarIcon },
  { name: "Recent", href: "/dashboard/recent", icon: ClockIcon },
  { name: "Shared", href: "/dashboard/shared", icon: Share2Icon },
  { name: "Neural Core", href: "/dashboard/ai-chat", icon: SparklesIcon },
  { name: "AI Cleanup", href: "/dashboard/cleanup", icon: CpuIcon },
  { name: "Storage", href: "/dashboard/storage", icon: HardDriveIcon },
  { name: "Trash", href: "/dashboard/trash", icon: Trash2Icon },
  { name: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
];

import FolderTree from "./FolderTree";

export default function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn("w-64 h-screen border-r border-white/10 glass-panel flex flex-col p-4 fixed left-0 top-0", className)}>

      <div className="flex items-center gap-2 px-2 py-4 mb-6">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center neon-border">
          <UploadCloudIcon className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-wider text-white neon-text">H&R CLOUD</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-2 space-y-6">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive 
                    ? "bg-primary/20 text-primary neon-border" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Directory Structure */}
        <div className="space-y-2">
          <h4 className="text-[10px] text-gray-500 font-mono tracking-widest px-2 uppercase font-semibold">
            SECTOR DIRECTORIES
          </h4>
          <FolderTree />
        </div>
      </div>

      <div className="mt-auto p-4 glass-panel rounded-xl border border-primary/30 bg-primary/10">
        <p className="text-xs text-gray-400 mb-2">SYSTEM STATUS</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
          <span className="text-sm text-green-400 font-mono">All Systems Operational</span>
        </div>
      </div>
    </aside>
  );
}
