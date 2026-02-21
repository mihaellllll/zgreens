import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CropLibrary from './pages/CropLibrary';
import Batches from './pages/Batches';
import Tasks from './pages/Tasks';
import Profitability from './pages/Profitability';
import Sales from './pages/Sales';
import Storage from './pages/Storage';
import Harvests from './pages/Harvests';

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50/50">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/crops" element={<CropLibrary />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/harvests" element={<Harvests />} />
          <Route path="/profitability" element={<Profitability />} />
          <Route path="/sales" element={<Sales />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
