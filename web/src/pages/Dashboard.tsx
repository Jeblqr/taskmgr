import { useEffect, useState } from "react";
import ResourceChart from "../components/ResourceChart";
import { Activity, Cpu, Database, Server } from "lucide-react";

interface SystemMetrics {
    cpu: number;
    mem_used: number;
    mem_total: number;
    gpu?: {
       util: number;
       mem_used: number;
       mem_total: number;
    };
    tasks?: any[];
}

export default function Dashboard() {
    const [history, setHistory] = useState<any[]>([]);
    const [latest, setLatest] = useState<SystemMetrics | null>(null);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Always use window.location.host. Vite proxy will forward to 3000 in Dev.
        const host = window.location.host;
        const ws = new WebSocket(`${protocol}//${host}/api/stats`);
        
        ws.onmessage = (ev) => {
            try {
                const metrics: SystemMetrics = JSON.parse(ev.data);
                setLatest(metrics);
                
                const point = {
                    time: new Date().toISOString(),
                    cpu: metrics.cpu,
                    mem: (metrics.mem_used / metrics.mem_total) * 100,
                    gpu: metrics.gpu ? metrics.gpu.util : 0,
                };

                setHistory(prev => {
                    const newHist = [...prev, point];
                    if (newHist.length > 60) newHist.shift(); // Keep last 60 points (approx 2 mins if 2s interval)
                    return newHist;
                });
            } catch (e) {
                console.error("Failed to parse stats", e);
            }
        };

        return () => ws.close();
    }, []);

    if (!latest) return (
        <div className="flex h-screen items-center justify-center bg-[#030712] text-gray-500 gap-3">
             <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
             Connecting to system monitor...
        </div>
    );

    const memPercent = (latest.mem_used / latest.mem_total) * 100;
    const gpuPercent = latest.gpu ? latest.gpu.util : 0;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">System Overview</h1>
                     <p className="text-gray-400">Real-time monitoring of your infrastructure.</p>
                </div>
                <div className="flex gap-2 text-sm">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
                    </span>
                </div>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 flex flex-col justify-between h-32 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Cpu size={24} /></div></div>
                    <div className="text-gray-400 text-sm font-medium z-10">CPU Usage</div>
                    <div className="text-3xl font-bold text-white z-10">{latest.cpu.toFixed(1)}%</div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </div>

                 <div className="glass-card p-6 flex flex-col justify-between h-32 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Database size={24} /></div></div>
                    <div>
                        <div className="text-gray-400 text-sm font-medium">Memory</div>
                        <div className="text-xs text-gray-500 font-mono mt-1">{(latest.mem_used / 1024 / 1024 / 1024).toFixed(1)}GB / {(latest.mem_total / 1024 / 1024 / 1024).toFixed(1)}GB</div>
                    </div>
                    <div className="text-3xl font-bold text-white">{memPercent.toFixed(1)}%</div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-purple-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </div>

                 <div className="glass-card p-6 flex flex-col justify-between h-32 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-4 opacity-50"><div className="p-2 bg-green-500/10 rounded-lg text-green-400"><Activity size={24} /></div></div>
                    <div className="text-gray-400 text-sm font-medium">GPU Load</div>
                    <div className="text-3xl font-bold text-white">{latest.gpu ? `${gpuPercent}%` : "N/A"}</div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-green-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </div>

                 <div className="glass-card p-6 flex flex-col justify-between h-32 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Server size={24} /></div></div>
                    <div className="text-gray-400 text-sm font-medium">Active Tasks</div>
                    <div className="text-3xl font-bold text-white">{latest.tasks?.length || 0}</div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <ResourceChart data={history} dataKey="cpu" color="#60a5fa" title="CPU History" />
                <ResourceChart data={history} dataKey="mem" color="#a855f7" title="Memory History" />
                {latest.gpu && <ResourceChart data={history} dataKey="gpu" color="#4ade80" title="GPU History" />}
            </div>
        </div>
    );
}
