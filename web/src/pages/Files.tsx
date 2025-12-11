import { useEffect, useState } from "react";
import { fetcher } from "../lib/api";
import { Folder, FileText, ChevronRight, ArrowUp, File, Home } from "lucide-react";
import clsx from "clsx";

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    modified: number;
}

export default function Files() {
    const [currentPath, setCurrentPath] = useState("/");
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [selectedFile, setSelectedFile] = useState<{name: string, content: string} | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadDir(currentPath);
    }, [currentPath]);

    const loadDir = async (path: string) => {
        setLoading(true);
        try {
            const data = await fetcher(`/fs/ls?path=${encodeURIComponent(path)}`);
            setEntries(data);
            setSelectedFile(null);
        } catch (e) {
            console.error(e);
            alert("Failed to load directory");
        } finally {
            setLoading(false);
        }
    };

    const loadFile = async (entry: FileEntry) => {
        if (entry.size > 1024 * 1024 * 5) { // 5MB limit check (though backend reads all)
             if (!confirm("File is large (>5MB). Load anyway?")) return;
        }
        
        setLoading(true);
        try {
            const content = await fetcher(`/fs/read?path=${encodeURIComponent(entry.path)}`, { 
                headers: { 'Accept': 'text/plain' } // Backend returns string directly
            });
            // Fetcher might try to JSON parse. If backend returns raw string, we might need handle that.
            // Our fetcher API implementation:
            // const res = await fetch(...); return res.json();
            // Wait, fs_read backend returns `impl IntoResponse`. If it returns a String, Axum treats it as text/plain usually.
            // But fetcher expects JSON?
            // Let's assume fetcher needs adjustment or we use fetch directly.
            
            // Re-implementing fetch here for safety if fetcher forces JSON.
             const res = await fetch(`http://localhost:3000/api/fs/read?path=${encodeURIComponent(entry.path)}`);
             if (!res.ok) throw new Error("Failed to read file");
             const text = await res.text();
             
             setSelectedFile({ name: entry.name, content: text });
        } catch (e) {
            console.error(e);
            alert("Failed to read file");
        } finally {
            setLoading(false);
        }
    };

    const handleEntryClick = (entry: FileEntry) => {
        if (entry.is_dir) {
            setCurrentPath(entry.path);
        } else {
            loadFile(entry);
        }
    };

    const goUp = () => {
        if (currentPath === "/") return;
        const parts = currentPath.split("/").filter(Boolean);
        parts.pop();
        const parent = "/" + parts.join("/");
        setCurrentPath(parent || "/");
    };

    return (
        <div className="flex flex-col h-screen bg-black text-gray-200">
             <div className="border-b border-gray-800 p-4 bg-gray-900/50 flex items-center gap-4">
                <button onClick={() => setCurrentPath("/")} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                    <Home size={18} />
                </button>
                <div className="flex items-center gap-1 text-sm font-mono text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap">
                    <span className="text-gray-600">server:</span>
                    {currentPath.split("/").map((part, i, arr) => (
                        <div key={i} className="flex items-center">
                            {i > 0 && <ChevronRight size={14} className="mx-1 text-gray-700" />}
                            <span 
                                className={clsx("cursor-pointer hover:text-white", i === arr.length - 1 && "text-white font-bold")}
                                onClick={() => {
                                    const newPath = "/" + arr.slice(1, i + 1).join("/");
                                    setCurrentPath(newPath);
                                }}
                            >
                                {part || "/"}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className={clsx("flex-1 overflow-y-auto p-4 transition-all", selectedFile ? "w-1/3 border-r border-gray-800" : "w-full")}>
                    {currentPath !== "/" && (
                        <div 
                            onClick={goUp}
                            className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer text-gray-500 mb-2"
                        >
                            <ArrowUp size={16} />
                            <span className="text-sm">..</span>
                        </div>
                    )}
                    
                    {loading && <div className="text-gray-600 p-4">Loading...</div>}

                    {!loading && entries.map((entry) => (
                        <div 
                            key={entry.path}
                            onClick={() => handleEntryClick(entry)}
                            className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer group"
                        >
                            <div className={clsx("text-gray-500 group-hover:text-blue-400", entry.is_dir ? "text-yellow-500" : "")}>
                                {entry.is_dir ? <Folder size={18} fill="currentColor" className="opacity-20 stroke-current text-yellow-500" /> : <FileText size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate">{entry.name}</div>
                                <div className="text-xs text-gray-600 flex gap-4">
                                    <span>{entry.is_dir ? "Directory" : (entry.size / 1024).toFixed(1) + " KB"}</span>
                                    <span>{new Date(entry.modified * 1000).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedFile && (
                    <div className="flex-1 flex flex-col bg-[#09090b] w-2/3">
                        <div className="border-b border-gray-800 p-2 flex justify-between items-center bg-gray-900/50">
                            <span className="text-sm font-mono text-gray-400">{selectedFile.name}</span>
                            <button onClick={() => setSelectedFile(null)} className="text-xs text-gray-500 hover:text-white px-2">Close</button>
                        </div>
                        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-300 leading-relaxed">
                            {selectedFile.content}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
