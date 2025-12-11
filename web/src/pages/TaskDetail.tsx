import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetcher, API_BASE } from "../lib/api";
import { Terminal as XTerminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Play, Square, Activity, Cpu, Terminal } from "lucide-react";
import clsx from "clsx";

interface Task {
    id: string;
    name: string;
    status: string;
    command: string;
    pid?: number;
    created_at: string;
}

export default function TaskDetail() {
    const { id } = useParams();
    const [task, setTask] = useState<Task | null>(null);
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        fetcher(`/tasks/${id}`).then(setTask);
        const interval = setInterval(() => {
            fetcher(`/tasks/${id}`).then(setTask);
        }, 2000);
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return;

        const term = new XTerminal({
            theme: {
                background: '#09090b',
                foreground: '#f4f4f5',
                cursor: '#22c55e',
                selectionBackground: '#22c55e40',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            cursorBlink: true,
            convertEol: true, // Important for properly rendering \n
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;

        // Connect to PTY WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env.DEV ? "localhost:3000" : window.location.host;
        const wsUrl = `${protocol}//${host}/api/tasks/${id}/pty`;
        const ws = new WebSocket(wsUrl);

        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            term.writeln('\x1b[32m>>> Connected to task terminal\x1b[0m');
        };

        ws.onmessage = (ev) => {
            // Received data from PTY (backend sends broadcasted output)
            if (typeof ev.data === 'string') {
                term.write(ev.data);
            } else {
                term.write(new Uint8Array(ev.data));
            }
        };

        ws.onclose = () => {
            term.writeln('\r\n\x1b[31m>>> Connection closed\x1b[0m');
        };

        // UI -> PTY
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        wsRef.current = ws;

         const handleResize = () => fitAddon.fit();
         window.addEventListener('resize', handleResize);

         return () => {
             ws.close();
             term.dispose();
             window.removeEventListener('resize', handleResize);
             xtermRef.current = null;
         };
    }, [id]);

    const handleStart = async () => {
        try {
            await fetch(`${API_BASE}/tasks/${id}/start`, { method: "POST" });
        } catch (e) {
            console.error(e);
        }
    };

    if (!task) return <div className="p-8 text-gray-500">Loading task...</div>;

    return (
        <div className="flex flex-col h-screen bg-[#030712] text-gray-200 animate-slide-up">
            {/* Header */}
            <div className="border-b border-white/5 p-4 flex justify-between items-center bg-[#030712]/50 backdrop-blur z-20">
                <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gray-800 text-gray-400 flex items-center justify-center border border-white/5">
                        <Terminal size={20} />
                     </div>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-3">
                            {task.name}
                        </h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border", 
                                task.status === "Running" ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10" : "border-gray-700 text-gray-500 bg-gray-800"
                            )}>
                                {task.status}
                            </span>
                            <span className="text-gray-600 text-xs font-mono">ID: {task.id.substring(0,8)}</span>
                            {task.pid && <span className="text-gray-600 text-xs font-mono border-l border-white/10 pl-3">PID: {task.pid}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    {task.status !== "Running" && (
                        <button onClick={handleStart} className="btn-primary">
                            <Play size={16} fill="currentColor" /> Start Task
                        </button>
                    )}
                    {task.status === "Running" && (
                        <button className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                            <Square size={16} fill="currentColor" /> Stop
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Terminal Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#030712] p-6 pr-0">
                    <div className="flex-1 rounded-xl border border-white/10 overflow-hidden relative bg-[#09090b] shadow-2xl">
                         {/* Terminal Toolbar */}
                         <div className="absolute top-3 right-4 z-10 flex gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                            <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
                         </div>
                         <div ref={terminalRef} className="absolute inset-4 mt-8" />
                    </div>
                </div>

                {/* Sidebar Stats Area */}
                <div className="w-80 border-l border-white/5 p-6 bg-[#030712]/50 flex flex-col gap-6 backdrop-blur-sm z-10">
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Activity size={14} /> Live Metrics
                        </h3>
                        {/* Placeholder for Graphs - Need Per-Task PID stats from WebSocket */}
                        <div className="h-32 rounded-lg border border-dashed border-gray-800 flex flex-col items-center justify-center text-xs text-gray-600 mb-2 gap-2 bg-white/5">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center animate-pulse"><Activity size={14} /></div>
                            Waiting for stats stream...
                        </div>
                    </div>

                    <div>
                         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Cpu size={14} /> Execution Context
                        </h3>
                        <div className="glass-card p-4 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Command</div>
                            <div className="font-mono text-sm text-emerald-400 break-all leading-relaxed">
                                {task.command}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
