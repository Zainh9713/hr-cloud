"use client";
import { useState, useEffect } from "react";

interface SpreadsheetPreviewProps {
  url: string;
}

type WorkbookData = {
  sheetNames: string[];
  sheets: Record<string, string[][]>;
};

function colHeader(index: number): string {
  let temp = "";
  let i = index;
  while (i >= 0) {
    temp = String.fromCharCode((i % 26) + 65) + temp;
    i = Math.floor(i / 26) - 1;
  }
  return temp;
}

export default function SpreadsheetPreview({ url }: SpreadsheetPreviewProps) {
  const [wbData, setWbData] = useState<WorkbookData | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSheet() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();

        // Dynamic import to keep XLSX client-only (large bundle)
        const XLSX = await import("xlsx");
        const wb = XLSX.read(arrayBuffer, { type: "array" });

        if (active) {
          const sheetsData: Record<string, string[][]> = {};
          for (const name of wb.SheetNames) {
            const json = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
              header: 1,
              defval: "",
            });
            sheetsData[name] = json as string[][];
          }
          setWbData({ sheetNames: wb.SheetNames, sheets: sheetsData });
          setActiveSheet(wb.SheetNames[0] ?? "");
          setLoading(false);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to parse spreadsheet.";
        console.error("[SpreadsheetPreview] Error:", err);
        if (active) {
          setError(message);
          setLoading(false);
        }
      }
    }

    loadSheet();
    return () => { active = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-[65vh] flex items-center justify-center bg-[#070714] border border-white/10 rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          <div className="font-mono text-primary text-xs animate-pulse">PARSING SPREADSHEET MATRIX...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[65vh] flex items-center justify-center bg-[#070714] border border-white/10 rounded-xl">
        <div className="text-center font-mono p-6 border border-red-500/30 rounded-xl bg-red-950/20 text-red-400 text-xs max-w-md">
          <p className="text-sm font-bold mb-2 text-red-300">MATRIX PARSE ERROR</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const tableData = wbData?.sheets[activeSheet] ?? [];
  const maxCols = tableData.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div className="w-full h-[65vh] flex flex-col bg-[#070714] border border-white/10 rounded-xl overflow-hidden font-mono text-xs">
      {/* Sheet tabs */}
      {(wbData?.sheetNames.length ?? 0) > 1 && (
        <div
          className="flex items-center gap-1.5 p-2 bg-white/5 border-b border-white/10 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {wbData!.sheetNames.map((sheet) => (
            <button
              key={sheet}
              onClick={() => setActiveSheet(sheet)}
              className={`px-3 py-1.5 rounded-t border transition-all duration-200 uppercase tracking-widest text-[10px] whitespace-nowrap ${
                activeSheet === sheet
                  ? "bg-primary/20 text-primary border-primary/50 font-bold"
                  : "bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              {sheet}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div
        className="flex-1 overflow-auto bg-black/40"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#4c1d95 transparent" }}
      >
        {tableData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Empty spreadsheet sector.
          </div>
        ) : (
          <table className="border-collapse table-fixed w-max min-w-full text-left">
            <thead>
              <tr className="bg-white/5 text-gray-400">
                <th className="w-10 border border-white/10 p-1.5 text-center bg-black/60 sticky top-0 left-0 z-20 text-[10px]">
                  #
                </th>
                {Array.from({ length: maxCols }).map((_, i) => (
                  <th
                    key={i}
                    className="min-w-[8rem] border border-white/10 p-1.5 text-center font-bold text-gray-300 bg-white/5 sticky top-0 z-10 select-none text-[10px]"
                  >
                    {colHeader(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/5 border-b border-white/5 group">
                  <td className="border border-white/10 p-1.5 text-center bg-black/60 text-gray-500 sticky left-0 z-10 select-none text-[10px]">
                    {rIdx + 1}
                  </td>
                  {Array.from({ length: maxCols }).map((_, cIdx) => {
                    const val = row[cIdx] !== undefined ? String(row[cIdx]) : "";
                    return (
                      <td
                        key={cIdx}
                        className="border border-white/10 p-1.5 text-gray-300 truncate max-w-[12rem] select-all leading-normal hover:bg-white/10"
                        title={val}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
