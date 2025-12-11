import { useEffect, useState, useRef } from "react";
import ResourceChart from "../components/ResourceChart";
import { Activity, Cpu, Database, Server } from "lucide-react";

interface SystemMetrics {
    cpu: number;
    memory: number; // used bytes
    memory_total: number;
    gpu?: {
       utilization: number;
       memory_used: number;
       memory_total: number;
    };
    tasks: any[];
}

export default function Dashboard() {
    const [history, setHistory] = useState<any[]>([]);
    const [latest, setLatest] = useState<SystemMetrics | null>(null);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env.DEV ? "localhost:3000" : window.location.host;
        const ws = new WebSocket(`${protocol}//${host}/api/stats`);
        
        ws.onmessage = (ev) => {
            try {
                const metrics: SystemMetrics = JSON.parse(ev.data);
                setLatest(metrics);
                
                const point = {
                    time: new Date().toISOString(),
                    cpu: metrics.cpu,
                    mem: (metrics.memory / metrics.memory_total) * 100,
                    gpu: metrics.gpu ? metrics.gpu.utilization : 0, // Assuming GPU util is %
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

    if (!latest) return <div className="p-8 text-gray-500">Connecting to system monitor...</div>;

    const memPercent = (latest.memory / latest.memory_total) * 100;
    const gpuPercent = latest.gpu ? latest.gpu.utilization : 0;

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">System Overview</h1>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-full text-blue-400"><Cpu size={24} /></div>
                    <div>
                        <div className="text-gray-500 text-sm">CPU Usage</div>
                        <div className="text-2xl font-bold text-white">{latest.cpu.toFixed(1)}%</div>
                    </div>
                </div>
                 <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-full text-purple-400"><Database size={24} /></div>
                    <div>
                        <div className="text-gray-500 text-sm">Memory Usage</div>
                        <div className="text-2xl font-bold text-white">{memPercent.toFixed(1)}%</div>
                        <div className="text-xs text-gray-600">{(latest.memory / 1024 / 1024 / 1024).toFixed(1)} GB / {(latest.memory_total / 1024 / 1024 / 1024).toFixed(1)} GB</div>
                    </div>
                </div>
                 <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-full text-green-400"><Activity size={24} /></div>
                    <div>
                        <div className="text-gray-500 text-sm">GPU Utilization</div>
                         <div className="text-2xl font-bold text-white">{latest.gpu ? `${gpuPercent}%` : "N/A"}</div>
                    </div>
                </div>
                 <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400"><Server size={24} /></div>
                    <div>
                        <div className="text-gray-500 text-sm">Active Tasks</div>
                        <div className="text-2xl font-bold text-white">{latest.tasks.length}</div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResourceChart data={history} dataKey="cpu" color="#60a5fa" title="Real-time CPU Usage" />
                <ResourceChart data={history} dataKey="mem" color="#a855f7" title="Real-time Memory Usage" />
                {latest.gpu && <ResourceChart data={history} dataKey="gpu" color="#4ade80" title="Real-time GPU Usage" />}
            </div>
        </div>
    );
}
