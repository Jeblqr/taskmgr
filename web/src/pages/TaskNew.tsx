import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../lib/api";
import { ChevronRight } from "lucide-react";

export default function TaskNew() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        command: "",
        env_type: "shell",
        env_name: "",
        cwd: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, args: [] })
            });
            if (res.ok) {
                navigate("/tasks");
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Task</h2>
            
            <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Task Name</label>
                    <input 
                        type="text" 
                        required
                        className="w-full bg-black border border-gray-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. Model Training Run #1"
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Environment Type</label>
                        <select 
                            className="w-full bg-black border border-gray-700 rounded-md p-2.5 text-white outline-none"
                            value={formData.env_type}
                            onChange={e => setFormData({...formData, env_type: e.target.value})}
                        >
                            <option value="shell">System Shell (sh)</option>
                            <option value="conda">Conda Environment</option>
                            <option value="uv">UV Project</option>
                            <option value="jupyter">Jupyter Kernel</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            {formData.env_type === "shell" ? "Environment Name (Optional)" : "Environment Name / Path"}
                        </label>
                        <input 
                            type="text" 
                            className="w-full bg-black border border-gray-700 rounded-md p-2.5 text-white outline-none"
                            value={formData.env_name}
                            onChange={e => setFormData({...formData, env_name: e.target.value})}
                            placeholder={formData.env_type === "jupyter" ? "/path/to/kernel.json" : "base"}
                            disabled={formData.env_type === "shell"}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Working Directory</label>
                    <input 
                        type="text" 
                        className="w-full bg-black border border-gray-700 rounded-md p-2.5 text-white outline-none"
                        value={formData.cwd}
                        onChange={e => setFormData({...formData, cwd: e.target.value})}
                        placeholder="/home/user/project"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Command</label>
                    <textarea 
                        required
                        className="w-full bg-black border border-gray-700 rounded-md p-2.5 text-white font-mono text-sm outline-none h-32"
                        value={formData.command}
                        onChange={e => setFormData({...formData, command: e.target.value})}
                        placeholder="python train.py --epochs 100"
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-md font-medium flex items-center gap-2 transition-all">
                        Launch Task <ChevronRight size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
}
