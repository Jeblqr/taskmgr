import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import TaskList from "./pages/TaskList";
import TaskDetail from "./pages/TaskDetail";
import TaskNew from "./pages/TaskNew";
import Files from "./pages/Files";
import Login from "./pages/Login";

// Simple Auth Guard
function RequireAuth() {
    const token = localStorage.getItem("auth_token");
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<TaskList />} />
              <Route path="tasks/new" element={<TaskNew />} />
              <Route path="tasks/:id" element={<TaskDetail />} />
              <Route path="files" element={<Files />} />
            </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
