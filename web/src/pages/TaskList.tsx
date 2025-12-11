import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetcher } from "../lib/api";
import { Activity, Terminal, Clock, AlertCircle } from "lucide-react";
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Running": return "text-emerald-400";
            case "Completed": return "text-blue-400";
            case "Failed": return "text-red-400";
            default: return "text-gray-400";
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-white tracking-tight">Active Tasks</h2>
                <Link to="/tasks/new" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium transition-colors">
                    + New Task
                </Link>
            </div>

            {loading ? (
                <div className="text-gray-500">Loading tasks...</div>
            ) : (
                <div className="grid gap-4">
                    {tasks.map((task) => (
                        <Link key={task.id} to={`/tasks/${task.id}`} className="block group">
                            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 transition-all group-hover:border-gray-700/50 group-hover:bg-gray-900/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={clsx("p-2 rounded-full bg-gray-800/50", getStatusColor(task.status))}>
                                            <Terminal size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-200 group-hover:text-white">{task.name}</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Activity size={14} /> {task.env_type}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={14} /> {new Date(task.created_at).toLocaleString()}
                                                </span>
                                                {task.pid && <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">PID: {task.pid}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className={clsx("px-3 py-1 rounded-full text-xs font-medium border", 
                                            task.status === "Running" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : 
                                            task.status === "Failed" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                                            "border-gray-700 bg-gray-800 text-gray-400"
                                        )}>
                                            {task.status}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-center py-12 text-gray-600">
                            No tasks found. Start one to get going.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
