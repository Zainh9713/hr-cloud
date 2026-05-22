"use client";
import ReactMarkdown from "react-markdown";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content || content === "RETRIEVING DATA SECTORS...") {
    return (
      <div className="w-full h-[65vh] flex items-center justify-center bg-[#070714] border border-white/10 rounded-xl">
        <div className="font-mono text-primary text-xs animate-pulse">RETRIEVING DATA SECTORS...</div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-[65vh] overflow-auto bg-[#070714] border border-white/10 text-gray-300 p-6 rounded-xl shadow-2xl max-w-none font-sans leading-relaxed"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#4c1d95 transparent" }}
    >
      <div className="prose prose-invert prose-sm max-w-none
        prose-headings:font-mono prose-headings:text-primary prose-headings:tracking-wider
        prose-a:text-secondary prose-a:no-underline hover:prose-a:underline
        prose-code:bg-white/10 prose-code:text-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:overflow-auto
        prose-blockquote:border-l-primary/50 prose-blockquote:text-gray-400 prose-blockquote:bg-white/5 prose-blockquote:rounded-r-xl prose-blockquote:py-0.5
        prose-hr:border-white/10
        prose-table:font-mono prose-table:text-xs
        prose-th:text-primary prose-th:border-white/10
        prose-td:border-white/10
        prose-strong:text-white
        prose-em:text-gray-200">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
