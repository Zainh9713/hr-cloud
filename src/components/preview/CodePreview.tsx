"use client";
import Editor from "@monaco-editor/react";

interface CodePreviewProps {
  content: string;
  filename: string;
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    html: "html",
    css: "css",
    py: "python",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    h: "cpp",
    c: "c",
    md: "markdown",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    txt: "plaintext",
  };
  return langMap[ext] ?? "plaintext";
}

export default function CodePreview({ content, filename }: CodePreviewProps) {
  return (
    <div className="w-full h-[65vh] rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e]">
      <Editor
        height="100%"
        language={getLanguage(filename)}
        theme="vs-dark"
        value={content}
        options={{
          readOnly: true,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: "Consolas, 'Courier New', monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          domReadOnly: true,
          contextmenu: false,
          wordWrap: "on",
          folding: true,
        }}
        loading={
          <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-primary font-mono text-xs animate-pulse">
            INITIALIZING MONACO READER MATRIX...
          </div>
        }
      />
    </div>
  );
}
