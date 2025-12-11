import { useState } from "react";
import { Lock } from "lucide-react";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            if (data.status === "ok") {
                localStorage.setItem("auth_token", data.token);
                localStorage.setItem("auth_user", username);
                window.location.href = "/dashboard";
            } else {
                setError(data.message || "Invalid credentials");
            }
        } catch (e) {
            setError("Login failed");
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-[#030712] text-gray-200 font-sans">
            <div className="w-full max-w-md p-8 glass-panel animate-fade-in flex flex-col gap-6">
                <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Authentication Required</h1>
                    <p className="text-gray-400 text-sm">Please enter your access token to continue.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="input-field w-full"
                            autoFocus
                        />
                    </div>
                    <div>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="input-field w-full"
                        />
                    </div>
                    
                    {error && <div className="text-red-400 text-sm text-center">{error}</div>}

                    <button type="submit" className="btn-primary w-full justify-center">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
}
