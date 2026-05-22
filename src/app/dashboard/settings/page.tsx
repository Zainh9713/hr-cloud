"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "react-hot-toast";
import { KeyRoundIcon, ShieldAlertIcon, UserIcon } from "lucide-react";

export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore();
  const [password, setPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) {
      fetchUser();
    }
  }, [user, fetchUser]);

  const handleUpdatePassword = async () => {
    if (!password) {
      toast.error("Please enter a new password");
      return;
    }
    if (password.length < 6) {
      toast.error("Security key must be at least 6 characters");
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update security credentials");

      toast.success("Security keys re-compiled and updated");
      setPassword("");
    } catch (err: any) {
      toast.error(err.message || "Encryption update failed");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] tracking-wider">
        SYSTEM PREFERENCES
      </h1>
      <div className="grid gap-6">
        <div className="p-6 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none"></div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-emerald-400" /> Account Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1 font-mono">OPERATOR IDENTITY</label>
              <input 
                type="text" 
                disabled 
                value={user?.name || "Loading name..."} 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white/70 font-mono focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1 font-mono">COMMS ROUTE (EMAIL)</label>
              <input 
                type="email" 
                disabled 
                value={user?.email || "Loading email..."} 
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white/70 font-mono focus:outline-none" 
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-2xl rounded-full pointer-events-none"></div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <KeyRoundIcon className="w-5 h-5 text-purple-400" /> Security Protocol
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1 font-mono">NEW CIPHER KEY (PASSWORD)</label>
              <input 
                type="password" 
                placeholder="Enter new security key" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:border-purple-500 transition-colors" 
              />
            </div>
            
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs text-purple-300 font-mono">
              <ShieldAlertIcon className="w-4 h-4 flex-shrink-0" />
              <span>Updating your credentials will re-encrypt authentication sessions. Use strong entropy.</span>
            </div>

            <button 
              onClick={handleUpdatePassword}
              disabled={updating}
              className="px-6 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600/40 rounded-lg transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 font-bold tracking-wider font-mono text-xs uppercase"
            >
              {updating ? "RE-COMPILING..." : "Update Keys"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
