import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  DashboardIcon,
  CropIcon,
  BatchIcon,
  TaskIcon,
  ChartIcon,
  SaleIcon,
  StorageIcon,
  HarvestIcon,
  AIIcon,
  LogoutIcon,
} from './Icons';

const NAV = [
  { to: '/',             label: 'Dashboard',       Icon: DashboardIcon },
  { to: '/crops',        label: 'Knjižnica',        Icon: CropIcon      },
  { to: '/batches',      label: 'Plitice',          Icon: BatchIcon     },
  { to: '/storage',      label: 'Skladište',        Icon: StorageIcon   },
  { to: '/tasks',        label: 'Zadaci',           Icon: TaskIcon      },
  { to: '/harvests',     label: 'Berbe',            Icon: HarvestIcon   },
  { to: '/profitability',label: 'Profitabilnost',   Icon: ChartIcon     },
  { to: '/sales',        label: 'Prodaja',          Icon: SaleIcon      },
  { to: '/ai',           label: 'AI Asistent',      Icon: AIIcon        },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className={`
      w-64 bg-brand-800 text-white flex flex-col shrink-0
      fixed md:static inset-y-0 left-0 z-30
      transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      <div className="px-6 py-6 border-b border-brand-700/80">
        <h1 className="text-2xl font-bold tracking-tight">ZGreens</h1>
        <p className="text-brand-200/90 text-base mt-1.5">{user?.name}</p>
      </div>
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/90 text-white shadow-sm'
                  : 'text-brand-100 hover:bg-brand-700/80 hover:text-white'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-5 border-t border-brand-700/80">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full text-left px-4 py-3 rounded-xl text-base text-brand-200 hover:bg-brand-700/80 hover:text-white transition-colors"
        >
          <LogoutIcon />
          <span>Odjava</span>
        </button>
      </div>
    </aside>
  );
}
