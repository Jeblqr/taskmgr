import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetcher, API_BASE } from "../lib/api";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Play, Square, Activity, Cpu } from "lucide-react";
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
    const xtermRef = useRef<Terminal | null>(null);
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

        const term = new Terminal({
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
        <div className="flex flex-col h-screen bg-black text-gray-200">
            {/* Header */}
            <div className="border-b border-gray-800 p-6 flex justify-between items-center bg-gray-900/50 backdrop-blur">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        {task.name}
                        <span className={clsx("text-xs px-2 py-0.5 rounded border font-mono", 
                            task.status === "Running" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-gray-700 text-gray-500"
                        )}>
                            {task.status}
                        </span>
                    </h1>
                    <div className="font-mono text-xs text-gray-500 mt-1 flex gap-4">
                        <span>ID: {task.id}</span>
                        {task.pid && <span>PID: {task.pid}</span>}
                    </div>
                </div>
                <div className="flex gap-4">
                    {task.status !== "Running" && (
                        <button onClick={handleStart} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium transition-colors">
                            <Play size={16} fill="currentColor" /> Start Task
                        </button>
                    )}
                    {task.status === "Running" && (
                        <button className="flex items-center gap-2 bg-red-900/50 hover:bg-red-900/80 border border-red-800 text-red-200 px-4 py-2 rounded-md font-medium transition-colors">
                            <Square size={16} fill="currentColor" /> Stop
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Terminal Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-black p-4">
                    <div className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                        <Terminal size={14} /> Live Output
                    </div>
                    <div className="flex-1 rounded-lg border border-gray-800 overflow-hidden relative bg-[#09090b]">
                         <div ref={terminalRef} className="absolute inset-2" />
                    </div>
                </div>

                {/* Sidebar Stats Area (Placeholder) */}
                <div className="w-80 border-l border-gray-800 p-6 bg-gray-900/30 flex flex-col gap-6">
                    <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                            <Activity size={16} /> Resource Usage
                        </h3>
                        {/* Placeholder for Graphs - Need Per-Task PID stats from WebSocket */}
                        <div className="h-32 bg-gray-800/50 rounded flex items-center justify-center text-xs text-gray-600 mb-2">
                            Waiting for stats stream...
                        </div>
                    </div>


                    <div>
                         <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                            <Cpu size={16} /> Environment
                        </h3>
                        <div className="bg-gray-800/30 p-3 rounded text-sm font-mono text-gray-400 break-all">
                            {task.command}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
