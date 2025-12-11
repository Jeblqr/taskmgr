import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, authenticatedFetch, fetcher } from "../lib/api";
import { ChevronRight, Folder, FileCode, RefreshCw, Activity } from "lucide-react";
import FilePicker from "../components/FilePicker";

interface CondaEnv {
    name?: string;
    prefix: string;
}

export default function TaskNew() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<"launch" | "attach">("launch");

    // Launch Form Data
    const [formData, setFormData] = useState({
        name: "",
        command: "",
        env_type: "shell",
        env_name: "",
        cwd: ""
    });

    // Attach Form Data
    const [attachData, setAttachData] = useState({
        pid: "",
        name: ""
    });

    // Smart Env Features
    const [condaEnvs, setCondaEnvs] = useState<CondaEnv[]>([]);
    const [loadingEnvs, setLoadingEnvs] = useState(false);
    
    // Picker State
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerMode, setPickerMode] = useState<"cwd" | "env" | "script" | null>(null);

    // Load Conda Envs when selected
    useEffect(() => {
        if (formData.env_type === "conda") {
            loadCondaEnvs();
        }
    }, [formData.env_type]);

    const loadCondaEnvs = async () => {
        setLoadingEnvs(true);
        try {
            const data = await fetcher("/envs/conda");
            setCondaEnvs(data);
             // Auto-select first if none selected
            if (data.length > 0 && !formData.env_name) {
                setFormData(prev => ({ ...prev, env_name: data[0].name || data[0].prefix }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingEnvs(false);
        }
    };

    const handlePickerSelect = (path: string) => {
        if (pickerMode === "cwd") {
            setFormData(prev => ({ ...prev, cwd: path }));
            // Optional: Auto-detect venv in this new CWD
            detectVenv(path);
        } else if (pickerMode === "env") {
            setFormData(prev => ({ ...prev, env_name: path }));
        } else if (pickerMode === "script") {
            // If picking a script, we might want to append it to command or replace it
            setFormData(prev => ({ ...prev, command: path })); // For now replace
        }
        setPickerOpen(false);
        setPickerMode(null);
    };

    const detectVenv = async (path: string) => {
        try {
             const res = await fetcher(`/envs/venv?path=${encodeURIComponent(path)}`);
             if (res.exists && res.path) {
                 if (confirm(`Detected virtual environment at ${res.path}. Use it?`)) {
                     setFormData(prev => ({ ...prev, env_type: "uv", env_name: res.path }));
                 }
             }
        } catch (e) { /* ignore */ }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (mode === "launch") {
                const res = await authenticatedFetch(`${API_BASE}/tasks`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...formData, args: [] })
                });
                if (res.ok) navigate("/tasks");
            } else {
                // Attach Mode
                const res = await authenticatedFetch(`${API_BASE}/tasks/attach`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        pid: parseInt(attachData.pid), 
                        name: attachData.name 
                    })
                });
                if (res.ok) navigate("/tasks");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to create task");
        }
    };

    const openPicker = (mode: "cwd" | "env" | "script") => {
        setPickerMode(mode);
        setPickerOpen(true);
    };

    return (
        <div className="p-8 max-w-3xl mx-auto animate-fade-in relative">
            <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">Create New Task</h2>
            
            {/* Tabs */}
            <div className="flex gap-4 mb-8">
                <button 
                    onClick={() => setMode("launch")}
                    className={`px-6 py-2 rounded-lg transition-colors font-medium border ${mode === "launch" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"}`}
                >
                    Launch New Task
                </button>
                <button 
                    onClick={() => setMode("attach")}
                    className={`px-6 py-2 rounded-lg transition-colors font-medium border ${mode === "attach" ? "bg-blue-500/20 text-blue-300 border-blue-500/50" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"}`}
                >
                    Attach to Process
                </button>
            </div>

            <form onSubmit={handleSubmit} className="glass-card p-8 space-y-8">
                {mode === "launch" ? (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Task Name</label>
                            <input 
                                type="text" 
                                required
                                className="input-field w-full"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Model Training Run #1"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Environment Type</label>
                                <select 
                                    className="input-field w-full"
                                    value={formData.env_type}
                                    onChange={e => setFormData({...formData, env_type: e.target.value})}
                                >
                                    <option value="shell">System Shell (sh)</option>
                                    <option value="conda">Conda Environment</option>
                                    <option value="uv">UV / Venv Project</option>
                                    <option value="jupyter">Jupyter Kernel</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2 flex justify-between">
                                    <span>
                                        {formData.env_type === "shell" ? "Environment Name (Optional)" : 
                                        formData.env_type === "conda" ? "Select Environment" :
                                        "Environment Path"}
                                    </span>
                                    {formData.env_type === "conda" && (
                                        <button type="button" onClick={loadCondaEnvs} className="text-emerald-400 hover:text-emerald-300"><RefreshCw size={12}/></button>
                                    )}
                                </label>
                                
                                {formData.env_type === "conda" ? (
                                    <select 
                                        className="input-field w-full"
                                        value={formData.env_name}
                                        onChange={e => setFormData({...formData, env_name: e.target.value})}
                                        disabled={loadingEnvs}
                                    >
                                        {loadingEnvs && <option>Loading envs...</option>}
                                        {!loadingEnvs && condaEnvs.length === 0 && <option value="">No environments found</option>}
                                        {condaEnvs.map(env => (
                                            <option key={env.prefix} value={env.name || env.prefix}>
                                                {env.name ? `${env.name} (${env.prefix})` : env.prefix}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            className="input-field w-full"
                                            value={formData.env_name}
                                            onChange={e => setFormData({...formData, env_name: e.target.value})}
                                            placeholder={formData.env_type === "jupyter" ? "/path/to/kernel.json" : "base"}
                                            disabled={formData.env_type === "shell"}
                                        />
                                        {formData.env_type !== "shell" && (
                                            <button 
                                                type="button" 
                                                onClick={() => openPicker("env")}
                                                className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400"
                                                title="Browse"
                                            >
                                                <Folder size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Working Directory</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="input-field w-full"
                                    value={formData.cwd}
                                    onChange={e => setFormData({...formData, cwd: e.target.value})}
                                    placeholder="/home/user/project"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => openPicker("cwd")}
                                    className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400"
                                    title="Select Directory"
                                >
                                    <Folder size={18} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2 flex justify-between">
                                Command
                                <button 
                                    type="button"
                                    onClick={() => openPicker("script")}
                                    className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                >
                                    <FileCode size={12} /> Select Script
                                </button>
                            </label>
                            <textarea 
                                required
                                className="input-field w-full font-mono text-sm h-32"
                                value={formData.command}
                                onChange={e => setFormData({...formData, command: e.target.value})}
                                placeholder="python train.py --epochs 100"
                            />
                        </div>
                    </>
                ) : (
                    <>
                         <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-200 text-sm flex items-start gap-3">
                            <Activity className="shrink-0 mt-0.5" size={16} />
                            <div>
                                <p className="font-semibold mb-1">Attach to Running Process</p>
                                <p className="opacity-80">
                                    Monitor an existing local process by PID. The task will be tracked until it exits.
                                    Resource usage will be monitored, but output logs may not be available unless redirected to a file.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Process ID (PID)</label>
                            <input 
                                type="number" 
                                required
                                className="input-field w-full font-mono text-lg tracking-wider"
                                value={attachData.pid}
                                onChange={e => setAttachData({...attachData, pid: e.target.value})}
                                placeholder="e.g. 12345"
                                autoFocus
                            />
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Task Name / Label</label>
                            <input 
                                type="text" 
                                required
                                className="input-field w-full"
                                value={attachData.name}
                                onChange={e => setAttachData({...attachData, name: e.target.value})}
                                placeholder="e.g. Background Upload"
                            />
                        </div>
                    </>
                )}

                <div className="flex justify-end pt-4 border-t border-white/5">
                    <button type="submit" className="btn-primary">
                        {mode === "launch" ? "Launch Task" : "Attach Process"} <ChevronRight size={18} />
                    </button>
                </div>
            </form>

            {pickerOpen && (
                <FilePicker 
                    selectDir={pickerMode === "cwd" || pickerMode === "env"}
                    onCancel={() => setPickerOpen(false)}
                    onSelect={handlePickerSelect}
                    initialPath={formData.cwd || "/"}
                />
            )}
        </div>
    );
}
