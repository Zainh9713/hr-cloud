import StorageChart from "@/components/StorageChart";
import AIOptimizer from "@/components/AIOptimizer";

export default function StoragePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.8)] tracking-wider">
        STORAGE OPTIMIZATION
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StorageChart />
        <AIOptimizer />
      </div>
    </div>
  );
}
