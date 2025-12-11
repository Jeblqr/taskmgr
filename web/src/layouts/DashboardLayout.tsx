import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, List, FolderOpen, PlusSquare } from "lucide-react";
import clsx from "clsx";

export default function DashboardLayout() {
  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/tasks", icon: List, label: "Tasks" },
    { to: "/tasks/new", icon: PlusSquare, label: "New Task" },
    { to: "/files", icon: FolderOpen, label: "Files" },
  ];

  return (
    <div className="flex h-screen bg-[#030712] text-gray-200 font-sans selection:bg-emerald-500/30">
      {/* Sidebar background gradient/glass */}
      <aside className="w-72 border-r border-white/5 flex flex-col glass-panel relative z-20">
        <div className="p-8 pb-4">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <LayoutDashboard size={18} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    TaskMgr
                </h1>
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-2">Menu</div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-white/5 text-white border border-white/5 shadow-lg shadow-black/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5 hover:border hover:border-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className="relative z-10 transition-transform group-hover:scale-110 duration-200" />
                  <span className="font-medium relative z-10">{item.label}</span>
                  {/* Active glow effect */}
                   <div className={clsx("absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent transition-opacity duration-300 pointer-events-none", 
                     isActive ? "opacity-100" : "opacity-0"
                   )} /> 
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
            <div className="glass-card p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
                <div className="flex-1">
                    <div className="text-xs font-medium text-gray-400">System Status</div>
                    <div className="text-sm font-bold text-emerald-400">Operational</div>
                </div>
            </div>
             <div className="mt-4 text-center text-[10px] text-gray-600 font-mono">
                v0.1.0-beta
            </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[#030712] relative">
         {/* Subtle background ambient glow */}
         <div className="absolute top-0 left-0 w-full h-[500px] bg-emerald-900/10 blur-[120px] pointer-events-none"></div>
         <div className="relative z-10 h-full">
            <Outlet />
         </div>
      </main>
    </div>
  );
}
