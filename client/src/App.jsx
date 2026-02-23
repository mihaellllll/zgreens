import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import { MenuIcon } from './components/Icons';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CropLibrary from './pages/CropLibrary';
import Batches from './pages/Batches';
import Tasks from './pages/Tasks';
import Profitability from './pages/Profitability';
import Sales from './pages/Sales';
import Storage from './pages/Storage';
import Harvests from './pages/Harvests';
import AIHelper from './pages/AIHelper';

function ProtectedLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-brand-800 text-white flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            <MenuIcon size={20} color="#fff" />
          </button>
          <span className="font-bold text-lg">ZGreens</span>
        </div>

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
            <Route path="/ai" element={<AIHelper />} />
          </Routes>
        </main>
      </div>
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
