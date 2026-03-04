import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CropLibrary from './pages/CropLibrary';
import Batches from './pages/Batches';
import Storage from './pages/Storage';
import Tasks from './pages/Tasks';
import Profitability from './pages/Profitability';
import Sales from './pages/Sales';
import Harvests from './pages/Harvests';
import AIHelper from './pages/AIHelper';
import Calendar from './pages/Calendar';
import SettingsPage from './pages/Settings';
import { Menu, Sparkles } from 'lucide-react';

const NAV_LABELS = {
  '/':              'Dashboard',
  '/crops':         'Knjižnica',
  '/storage':       'Skladište',
  '/batches':       'Plitice',
  '/tasks':         'Zadaci',
  '/calendar':      'Kalendar',
  '/harvests':      'Berbe',
  '/sales':         'Prodaja',
  '/profitability': 'Profitabilnost',
  '/ai':            'AI Asistent',
  '/settings':      'Postavke',
};

const ProtectedLayout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pageLabel = NAV_LABELS[location.pathname] || 'ZGreens';

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F7F5F0' }}>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <Sidebar mobile={true} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right column: top bar (mobile) + main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Mobile top bar */}
        <div className="flex md:hidden items-center px-4 py-3" style={{ background: '#1A2E22', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', padding: '4px' }}
          >
            <Menu size={22} />
          </button>
          <span style={{ marginLeft: '12px', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em', flex: 1 }}>{pageLabel}</span>
          {location.pathname !== '/ai' && (
            <button
              onClick={() => navigate('/ai')}
              style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.85)', flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </button>
          )}
        </div>

        <main style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          scrollbarWidth: 'thin', scrollbarColor: '#E5E0D5 transparent',
        }}>
          <Outlet key={location.key} />
        </main>
      </div>

      {/* Floating AI helper — suppressed on the full /ai page */}
      {location.pathname !== '/ai' && <AIHelper />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/crops"         element={<CropLibrary />} />
            <Route path="/batches"       element={<Batches />} />
            <Route path="/storage"       element={<Storage />} />
            <Route path="/tasks"         element={<Tasks />} />
            <Route path="/profitability" element={<Profitability />} />
            <Route path="/sales"         element={<Sales />} />
            <Route path="/harvests"      element={<Harvests />} />
            <Route path="/ai"            element={<AIHelper fullPage />} />
            <Route path="/calendar"      element={<Calendar />} />
            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
