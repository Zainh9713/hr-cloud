"use client";
import { useState, useEffect, useRef } from "react";
import { 
  SendIcon, 
  SparklesIcon, 
  BotIcon, 
  UserIcon, 
  FileIcon, 
  HelpCircleIcon,
  Trash2Icon,
  PaperclipIcon
} from "lucide-react";
import { toast } from "react-hot-toast";

interface Message {
  role: "user" | "model" | "system";
  content: string;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "NEURAL CORE ONLINE. Welcome back, Operative. I am H&R Cloud's centralized Gemini AI core. How can I assist you with your storage grid telemetry or file decryption today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Fetch files for selection
  useEffect(() => {
    const fetchAllFiles = async () => {
      setLoadingFiles(true);
      try {
        const res = await fetch("/api/files");
        const data = await res.json();
        if (res.ok) {
          setFiles(data.files || []);
        }
      } catch (err) {
        console.error("Failed to load file context", err);
      } finally {
        setLoadingFiles(false);
      }
    };
    fetchAllFiles();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;

    const userMessageText = input.trim();
    setInput("");

    // Add user message locally
    const updatedMessages = [...messages, { role: "user" as const, content: userMessageText }];
    setMessages(updatedMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          fileId: selectedFileId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Neural link broken. Please retry.");

      setMessages(prev => [...prev, { role: "model" as const, content: data.message }]);
    } catch (err: any) {
      toast.error(err.message || "Failed to communicate with AI core");
      // Add system error message
      setMessages(prev => [...prev, { 
        role: "system" as const, 
        content: `ALERT: AI Neural connection timeout. Error: ${err.message || "Connection refused"}` 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (!confirm("Confirm formatting of local neural chat registers?")) return;
    setMessages([
      {
        role: "model",
        content: "Registers cleared. Neural Core initialized. Ready to receive commands."
      }
    ]);
  };

  const handleQuickPrompt = (promptText: string) => {
    setInput(promptText);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px] gap-4 animate-in fade-in duration-300">
      
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] tracking-wider flex items-center gap-2">
            <SparklesIcon className="w-8 h-8 text-primary animate-pulse" />
            NEURAL AI CORE
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1 uppercase tracking-widest">
            Gemini-powered natural intelligence system for secure asset analysis and diagnostics.
          </p>
        </div>
        <button 
          onClick={handleClearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-500/20 transition-all font-mono text-xs uppercase tracking-wider"
        >
          <Trash2Icon className="w-3.5 h-3.5" />
          Clear Registers
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* Chat Feed Panel */}
        <div className="flex-1 glass-panel rounded-2xl border border-white/10 flex flex-col min-w-0 bg-[#0a0a1f]/60 relative overflow-hidden">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg, index) => {
              const isModel = msg.role === "model";
              const isSystem = msg.role === "system";

              if (isSystem) {
                return (
                  <div key={index} className="flex justify-center">
                    <span className="px-3 py-1 bg-red-950/40 border border-red-900/60 rounded text-[11px] font-mono text-red-400 tracking-wider">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div 
                  key={index}
                  className={`flex gap-3 max-w-[85%] ${isModel ? "mr-auto" : "ml-auto flex-row-reverse"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border flex-shrink-0 ${
                    isModel 
                      ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
                      : "border-cyan-400/40 bg-cyan-950/20 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
                  }`}>
                    {isModel ? <BotIcon className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>
                  
                  <div className={`p-4 rounded-2xl border relative group ${
                    isModel 
                      ? "bg-white/5 border-white/5 rounded-tl-none text-gray-200" 
                      : "bg-primary/10 border-primary/30 rounded-tr-none text-white shadow-[0_0_10px_rgba(139,92,246,0.15)]"
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</p>
                    <span className="absolute bottom-1 right-2 text-[8px] font-mono text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isModel ? "Neural Core" : "User"}
                    </span>
                  </div>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-primary/40 bg-primary/10 text-primary animate-spin">
                  <BotIcon className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 text-gray-400 font-mono text-xs animate-pulse tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  SCANNING SECTOR DATABASES & RUNNING GEMINI SYNAPSE...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Form Footer */}
          <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-black/40 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatLoading ? "Gemini core busy..." : "Enter query or diagnostic request..."}
              disabled={chatLoading}
              className="flex-1 bg-[#05050f]/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 placeholder-gray-600 transition-all font-mono"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="p-3 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary disabled:opacity-40 disabled:hover:bg-primary/20 rounded-xl transition-all shadow-[0_0_10px_rgba(139,92,246,0.1)] hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Sidebar Controls */}
        <div className="w-72 flex flex-col gap-4 flex-shrink-0">
          
          {/* File Context Panel */}
          <div className="glass-panel rounded-2xl border border-white/10 p-4 bg-[#0a0a1f]/60 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm tracking-wide border-b border-white/10 pb-2">
              <PaperclipIcon className="w-4 h-4" />
              <span>LINK FILE CONTEXT</span>
            </div>
            
            <p className="text-gray-400 text-[11px] leading-relaxed">
              Link an active cloud file as context to feed its content snippet and AI analysis variables into Gemini.
            </p>

            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              disabled={loadingFiles}
              className="w-full bg-[#05050f] border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono cursor-pointer"
            >
              <option value="">-- No File Context --</option>
              {files.map((file) => (
                <option key={file._id} value={file._id}>
                  {file.originalName.length > 25 
                    ? file.originalName.slice(0, 22) + "..." 
                    : file.originalName} 
                  ({(file.size / 1024).toFixed(1)} KB)
                </option>
              ))}
            </select>

            {selectedFileId && (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded bg-primary/10 border border-primary/30 text-[11px] font-mono text-primary animate-pulse">
                <FileIcon className="w-3.5 h-3.5" />
                <span>Active Context Active</span>
              </div>
            )}
          </div>

          {/* Quick Prompts Panel */}
          <div className="glass-panel rounded-2xl border border-white/10 p-4 bg-[#0a0a1f]/60 flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm tracking-wide border-b border-white/10 pb-2">
              <HelpCircleIcon className="w-4 h-4" />
              <span>QUICK DIAGNOSTICS</span>
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => handleQuickPrompt("Summarize my current storage usage and provide statistics on my active files.")}
                className="w-full text-left p-2.5 rounded border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-gray-300 font-sans leading-snug"
              >
                Summarize Cloud Usage
              </button>
              <button 
                onClick={() => handleQuickPrompt("What are the most active sectors and folders in my database?")}
                className="w-full text-left p-2.5 rounded border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-gray-300 font-sans leading-snug"
              >
                Identify Active Sectors
              </button>
              <button 
                onClick={() => handleQuickPrompt("Provide a security audit of my sharing configurations. Are any file streams publicly readable?")}
                className="w-full text-left p-2.5 rounded border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-gray-300 font-sans leading-snug"
              >
                Audit Shared Permissions
              </button>
              {selectedFileId && (
                <button 
                  onClick={() => handleQuickPrompt("Deeply analyze this active file. Extract its core purpose, suggest tags, and review its code structure/text details.")}
                  className="w-full text-left p-2.5 rounded border border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all text-xs text-primary font-sans leading-snug font-bold"
                >
                  Analyze Linked File Context
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
