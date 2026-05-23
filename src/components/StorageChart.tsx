"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#8b5cf6", "#0ea5e9", "#f43f5e", "#10b981"];

export default function StorageChart() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/storage")
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

  if (!stats) return <div className="h-64 flex items-center justify-center text-primary animate-pulse font-mono">CALCULATING DATA...</div>;

  const data = [
    { name: "Images", value: stats.usageByType?.images || 0 },
    { name: "Videos", value: stats.usageByType?.videos || 0 },
    { name: "Documents", value: stats.usageByType?.documents || 0 },
    { name: "Others", value: stats.usageByType?.others || 0 },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    data.push({ name: "Empty Space", value: 1 }); // placeholder to show empty chart
  }

  const usedFormatted = (stats.usedStorage / (1024 * 1024)).toFixed(2) + " MB";
  const totalFormatted = (stats.totalStorage / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  const percentageNum = Math.min(100, (stats.usedStorage / stats.totalStorage) * 100);
  const percentage = percentageNum.toFixed(1);

  // Dynamic colors based on usage
  let statusColor = "text-primary";
  let barGradient = "from-primary to-secondary";
  let ringColor = "bg-primary";
  let warningMessage = null;

  if (percentageNum >= 95) {
    statusColor = "text-red-500";
    barGradient = "from-red-500 to-red-700";
    ringColor = "bg-red-500";
    warningMessage = <div className="mt-2 text-xs text-red-500 font-bold animate-pulse text-center neon-text border border-red-500/30 bg-red-500/10 p-1 rounded">CRITICAL: STORAGE ALMOST FULL</div>;
  } else if (percentageNum >= 80) {
    statusColor = "text-yellow-500";
    barGradient = "from-yellow-400 to-orange-500";
    ringColor = "bg-yellow-500";
    warningMessage = <div className="mt-2 text-xs text-yellow-500 font-bold text-center border border-yellow-500/30 bg-yellow-500/10 p-1 rounded">WARNING: LOW STORAGE</div>;
  }

  return (
    <div className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 ${ringColor}/20 blur-3xl rounded-full pointer-events-none transition-colors`}></div>
      <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${ringColor} neon-border transition-colors`}></span>
        STORAGE CORE
      </h3>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="rgba(255,255,255,0.1)"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(139, 92, 246, 0.5)', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: any) => (Number(value) / (1024 * 1024)).toFixed(2) + " MB"}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Capacity Used</span>
          <span className={`${statusColor} font-bold transition-colors`}>{percentage}%</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r ${barGradient} relative transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
          <span>{usedFormatted} USED</span>
          <span>{totalFormatted} MAX</span>
        </div>
        {warningMessage}
      </div>
    </div>
  );
}
