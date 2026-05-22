import Link from "next/link";
import { ShieldCheckIcon, UploadCloudIcon, DatabaseIcon } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#05050f] text-white overflow-hidden relative">
      {/* Background Cyberpunk Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[150px] rounded-full"></div>
      
      {/* Navbar */}
      <nav className="glass-panel border-b border-white/10 px-8 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary flex items-center justify-center neon-border">
            <UploadCloudIcon className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-widest neon-text">H&R CLOUD</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="px-6 py-2 rounded-lg font-mono text-sm text-gray-300 hover:text-white transition-colors">
            LOGIN
          </Link>
          <Link href="/register" className="px-6 py-2 rounded-lg font-mono text-sm bg-primary text-white hover:bg-primary-dark transition-colors neon-border">
            INITIALIZE
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-secondary mb-8 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-secondary"></div>
          SYS_OS v4.0 DEPLOYED
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent">NEXT-GEN</span>
          CLOUD STORAGE
        </h1>
        
        <p className="max-w-2xl text-lg md:text-xl text-gray-400 font-mono mb-10 leading-relaxed">
          Store, encrypt, and access your data across the digital frontier. Powered by advanced neural networks and quantum-grade security protocols.
        </p>

        <Link href="/register" className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-primary font-mono rounded-xl hover:bg-primary-dark hover:scale-105 neon-border shadow-[0_0_20px_rgba(139,92,246,0.5)]">
          ACCESS THE CORE
          <DatabaseIcon className="w-5 h-5 ml-2 group-hover:animate-bounce" />
        </Link>
      </main>
    </div>
  );
}
