"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockIcon, MailIcon, UserIcon, NetworkIcon } from "lucide-react";
import { toast } from "react-hot-toast";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration Failed");
      toast.success("Clearance Granted");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#05050f]">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-secondary/20 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10 glass-panel p-8 rounded-3xl neon-border border-secondary/50 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-secondary/10 rounded-full flex items-center justify-center mb-4 neon-border border-secondary/50 shadow-[0_0_15px_rgba(14,165,233,0.5)] animate-pulse">
            <NetworkIcon className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest text-shadow-[0_0_10px_rgba(14,165,233,0.7)]">SYSTEM_JOIN</h1>
          <p className="text-sm text-gray-400 font-mono mt-2">NEW AGENT REGISTRATION</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-xs font-mono text-secondary mb-2 uppercase">Agent Designation (Name)</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-mono"
                placeholder="Agent 47"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-secondary mb-2 uppercase">Identity String (Email)</label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-mono"
                placeholder="agent@hr-cloud.net"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono text-secondary mb-2 uppercase">Encryption Key (Password)</label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-mono"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-secondary hover:bg-secondary/80 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 uppercase tracking-widest shadow-[0_0_15px_rgba(14,165,233,0.5)]"
          >
            {loading ? "PROCESSING..." : "REQUEST CLEARANCE"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400 font-mono">
          ALREADY REGISTERED?{" "}
          <Link href="/login" className="text-primary hover:text-white transition-colors underline decoration-primary/50 underline-offset-4">
            INITIATE LOGIN
          </Link>
        </p>
      </div>
    </div>
  );
}
