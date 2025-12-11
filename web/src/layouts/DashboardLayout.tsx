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
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      <aside className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold tracking-tight text-emerald-500">TaskMgr</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  isActive
                    ? "bg-gray-800 text-emerald-400"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                )
              }
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 text-xs text-gray-600">
          v0.1.0 • Running
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-black">
        <Outlet />
      </main>
    </div>
  );
}
