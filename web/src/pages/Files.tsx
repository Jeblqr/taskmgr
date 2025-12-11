import { useEffect, useState } from "react";
import { fetcher, API_BASE } from "../lib/api";
import { Folder, FileText, ChevronRight, ArrowUp, Home } from "lucide-react";
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
        if (entry.size > 1024 * 1024 * 5) { // 5MB limit check
             if (!confirm("File is large (>5MB). Load anyway?")) return;
        }
        
        setLoading(true);
        try {
            // Use native fetch to handle non-JSON responses (text content)
            const res = await fetch(`${API_BASE}/fs/read?path=${encodeURIComponent(entry.path)}`);
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
        <div className="flex flex-col h-screen bg-[#030712] text-gray-200 animate-slide-up">
             {/* Breadcrumb Bar */}
             <div className="border-b border-white/5 p-4 bg-[#030712]/50 backdrop-blur z-20 flex items-center gap-4 shadow-sm">
                <button onClick={() => setCurrentPath("/")} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
                    <Home size={18} />
                </button>
                <div className="flex items-center gap-1 text-sm font-mono text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap px-4 py-1.5 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-gray-600 select-none">root@server:</span>
                    {currentPath.split("/").map((part, i, arr) => (
                        <div key={i} className="flex items-center group">
                            {i > 0 && <ChevronRight size={14} className="mx-1 text-gray-700 group-hover:text-gray-500 transition-colors" />}
                            <span 
                                className={clsx("cursor-pointer hover:text-emerald-400 transition-colors hover:underline underline-offset-4", i === arr.length - 1 && "text-white font-bold")}
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
                <div className={clsx("flex-1 overflow-y-auto p-6 transition-all", selectedFile ? "w-1/3 border-r border-white/5" : "w-full")}>
                    {currentPath !== "/" && (
                        <div 
                            onClick={goUp}
                            className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer text-gray-500 mb-2 transition-colors border border-transparent hover:border-white/5"
                        >
                            <ArrowUp size={16} />
                            <span className="text-sm font-medium">Up one level</span>
                        </div>
                    )}
                    
                    {loading && (
                        <div className="text-gray-500 flex items-center gap-2 p-4">
                            <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                            Loading directory...
                        </div>
                    )}

                    {!loading && (
                        <div className="grid grid-cols-1 gap-1">
                            {entries.map((entry) => (
                                <div 
                                    key={entry.path}
                                    onClick={() => handleEntryClick(entry)}
                                    className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer group transition-all border border-transparent hover:border-white/5 active:scale-[0.99]"
                                >
                                    <div className={clsx("p-2 rounded-lg transition-colors", entry.is_dir ? "text-yellow-400 bg-yellow-400/10" : "text-blue-400 bg-blue-400/10")}>
                                        {entry.is_dir ? <Folder size={20} fill="currentColor" fillOpacity={0.2} /> : <FileText size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                                        <div className="truncate font-medium text-gray-300 group-hover:text-white transition-colors">{entry.name}</div>
                                        <div className="text-xs text-gray-600 flex gap-6 shrink-0 font-mono">
                                            <span className="w-20 text-right">{entry.is_dir ? "-" : (entry.size / 1024).toFixed(1) + " KB"}</span>
                                            <span className="w-24 text-right">{new Date(entry.modified * 1000).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedFile && (
                    <div className="flex-1 flex flex-col bg-[#09090b] w-2/3 animate-fade-in">
                        <div className="border-b border-white/5 p-4 flex justify-between items-center bg-[#09090b]">
                            <span className="text-sm font-mono text-emerald-400 flex items-center gap-2">
                                <FileText size={14} />
                                {selectedFile.name}
                            </span>
                            <button onClick={() => setSelectedFile(null)} className="text-xs font-medium text-gray-500 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors uppercase tracking-wider">Close Preview</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-[#030712]">
                            <pre className="text-xs font-mono text-gray-300 leading-relaxed p-4 rounded-lg border border-white/5 bg-[#09090b] shadow-inner">
                                {selectedFile.content}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
