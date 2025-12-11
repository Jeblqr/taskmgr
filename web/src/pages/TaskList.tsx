import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetcher } from "../lib/api";
import { Activity, Terminal, Clock } from "lucide-react";
import clsx from "clsx";

interface Task {
    id: string;
    name: string;
    status: string;
    env_type: string;
    created_at: string;
    started_at?: string;
    pid?: number;
}

export default function TaskList() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetcher("/tasks").then(setTasks).finally(() => setLoading(false));
        const interval = setInterval(() => {
            fetcher("/tasks").then(setTasks);
        }, 2000);
        return () => clearInterval(interval);
    }, []);


    return (
        <div className="p-8 max-w-7xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                     <h2 className="text-3xl font-bold text-white tracking-tight">Active Tasks</h2>
                     <p className="text-gray-400">Manage and monitor your running processes.</p>
                </div>
                <Link to="/tasks/new" className="btn-primary">
                    + New Task
                </Link>
            </div>

            {loading ? (
                <div className="text-gray-500 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                    Loading tasks...
                </div>
            ) : (
                <div className="grid gap-4">
                    {tasks.map((task) => (
                        <Link key={task.id} to={`/tasks/${task.id}`} className="block group">
                            <div className="glass-card p-6 flex items-center justify-between group-hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-5">
                                    <div className={clsx("p-3 rounded-xl transition-colors", 
                                        task.status === "Running" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-800 text-gray-400"
                                    )}>
                                        <Terminal size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{task.name}</h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1.5">
                                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                                                <Activity size={14} /> {task.env_type}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={14} /> {new Date(task.created_at).toLocaleString()}
                                            </span>
                                            {task.pid && <span className="font-mono text-xs text-gray-600">PID: {task.pid}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={clsx("px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider", 
                                        task.status === "Running" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : 
                                        task.status === "Failed" ? "border-red-500/20 bg-red-500/10 text-red-500" :
                                        "border-gray-700 bg-gray-800 text-gray-400"
                                    )}>
                                        {task.status}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-center py-20 text-gray-600 glass-card">
                            <div className="mb-4 text-gray-700">
                                <Terminal size={48} className="mx-auto opacity-20" />
                            </div>
                            No active tasks found. <br />Start a new process to get started.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
