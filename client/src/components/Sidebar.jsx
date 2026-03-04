import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, BookOpen, Layers, Package, CheckSquare,
  Calendar, Scissors, TrendingUp, ShoppingCart, Sparkles, LogOut, Settings,
} from 'lucide-react';

const NAV = [
  { to: '/',              label: 'Dashboard',      Icon: LayoutDashboard },
  { to: '/crops',         label: 'Knjižnica',       Icon: BookOpen        },
  { to: '/storage',       label: 'Skladište',       Icon: Package         },
  { to: '/batches',       label: 'Plitice',         Icon: Layers          },
  { to: '/tasks',         label: 'Zadaci',          Icon: CheckSquare     },
  { to: '/calendar',      label: 'Kalendar',        Icon: Calendar        },
  { to: '/harvests',      label: 'Berbe',           Icon: Scissors        },
  { to: '/sales',         label: 'Prodaja',         Icon: ShoppingCart    },
  { to: '/profitability', label: 'Profitabilnost',  Icon: TrendingUp      },
  { to: '/ai',            label: 'AI Asistent',     Icon: Sparkles        },
];

function UserAvatar({ name }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-forest-light to-forest-mid flex items-center justify-center text-xs font-bold text-white/95 shrink-0 border border-white/10 shadow-sm">
      {initials}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose, mobile = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {/* Mobile backdrop */}
      {mobile && isOpen && onClose && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[4px]"
          onClick={onClose}
        />
      )}

      <aside 
        className={`w-[240px] min-w-[240px] h-screen bg-[#1A2E22] border-r border-white/5 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          mobile ? `fixed top-0 left-0 z-30 ${isOpen ? 'translate-x-0 shadow-[8px_0_32px_rgba(0,0,0,0.35)]' : '-translate-x-full'}` : ''
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-8 border-b border-white/5 shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-serif text-[28px] font-semibold text-white tracking-tight leading-none">
              ZGreens
            </span>
            <span className="text-xl leading-none">🌿</span>
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] leading-none">
            Farm Management
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto no-scrollbar">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3.5 px-4 py-3 rounded-full mb-1 text-[13px] font-bold tracking-tight transition-all duration-200
                ${isActive 
                  ? 'bg-white text-forest-dark shadow-lg shadow-black/10' 
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                }
              `}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/5 shrink-0 bg-black/10">
          <div className="flex items-center gap-3 px-4 py-3 mb-1 rounded-2xl">
            <UserAvatar name={user?.name} />
            <div className="flex-1 overflow-hidden">
              <p className="m-0 text-sm font-bold text-white/90 truncate">
                {user?.name || 'Korisnik'}
              </p>
              <p className="m-0 text-[10px] text-white/30 truncate font-semibold uppercase tracking-wider">
                {user?.email || 'Premium Plan'}
              </p>
            </div>
          </div>
          
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) => `flex items-center gap-2.5 w-full px-4 py-2.5 rounded-full text-xs font-bold transition-all ${isActive ? 'text-white/70 bg-white/8' : 'text-white/30 hover:bg-white/5 hover:text-white/60'}`}
            style={{ textDecoration: 'none' }}
          >
            <Settings size={16} strokeWidth={1.5} />
            Postavke
          </NavLink>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-full border-none cursor-pointer text-xs font-bold text-white/30 transition-all hover:bg-clay/10 hover:text-clay-light"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Odjava
          </button>
        </div>
      </aside>
    </>
  );
}

