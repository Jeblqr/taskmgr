import { useState, useEffect } from "react";
import { fetcher } from "../lib/api";
import { Folder, File, ChevronRight, Home, ArrowUp, X } from "lucide-react";
import clsx from "clsx";

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    modified: number;
}

interface FilePickerProps {
    onSelect: (path: string) => void;
    onCancel: () => void;
    selectDir?: boolean; // If true, selecting a folder; else file
    initialPath?: string;
}

export default function FilePicker({ onSelect, onCancel, selectDir, initialPath }: FilePickerProps) {
    const [currentPath, setCurrentPath] = useState(initialPath || "/");
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadDir(currentPath);
    }, [currentPath]);

    const loadDir = async (path: string) => {
        setLoading(true);
        try {
            const data = await fetcher(`/fs/ls?path=${encodeURIComponent(path)}`);
            setEntries(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleEntryClick = (entry: FileEntry) => {
        if (entry.is_dir) {
            setCurrentPath(entry.path);
        } else if (!selectDir) {
            // Include full path
            onSelect(entry.path);
        }
    };

    const handleSelectCurrentDir = () => {
        onSelect(currentPath);
    };

    const goUp = () => {
        if (currentPath === "/") return;
        const parts = currentPath.split("/").filter(Boolean);
        parts.pop();
        setCurrentPath("/" + parts.join("/"));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-[800px] h-[600px] bg-[#09090b] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#030712]">
                    <h3 className="text-white font-medium flex items-center gap-2">
                        {selectDir ? <Folder size={18} className="text-yellow-400" /> : <File size={18} className="text-blue-400" />}
                        Select {selectDir ? "Directory" : "File"}
                    </h3>
                    <button onClick={onCancel} className="text-gray-500 hover:text-white"><X size={20} /></button>
                </div>

                {/* Breadcrumb */}
                <div className="p-2 bg-[#030712]/50 border-b border-white/5 flex items-center gap-2 overflow-x-auto">
                    <button onClick={() => setCurrentPath("/")} className="p-1 hover:bg-white/5 rounded text-gray-400"><Home size={16} /></button>
                    <div className="flex items-center text-sm font-mono text-gray-400 whitespace-nowrap">
                        {currentPath.split("/").map((part, i, arr) => (
                            <div key={i} className="flex items-center">
                                {i > 0 && <ChevronRight size={14} className="mx-1 text-gray-600" />}
                                <span 
                                    className="cursor-pointer hover:text-white hover:underline"
                                    onClick={() => setCurrentPath("/" + arr.slice(1, i + 1).join("/"))}
                                >
                                    {part || ""}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#030712]">
                     {currentPath !== "/" && (
                        <div onClick={goUp} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer text-gray-500 mb-1">
                            <ArrowUp size={16} /> ..
                        </div>
                    )}
                    
                    {loading ? (
                        <div className="text-gray-500 p-4">Loading...</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {entries.map(entry => (
                                <div 
                                    key={entry.path}
                                    onClick={() => handleEntryClick(entry)}
                                    className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer group"
                                >
                                    <div className={clsx(entry.is_dir ? "text-yellow-400/80" : "text-blue-400/80")}>
                                        {entry.is_dir ? <Folder size={18} /> : <File size={18} />}
                                    </div>
                                    <span className="flex-1 text-gray-300 group-hover:text-white truncate text-sm">
                                        {entry.name}
                                    </span>
                                    {!entry.is_dir && <span className="text-xs text-gray-600 font-mono">{(entry.size/1024).toFixed(1)}KB</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-[#030712] flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5">Cancel</button>
                    {selectDir && (
                        <button onClick={handleSelectCurrentDir} className="btn-primary">
                            Select Current Directory
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
