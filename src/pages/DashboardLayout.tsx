import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  LayoutGrid, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  RefreshCw,
  Bell,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { NotificationCenter } from '../components/NotificationCenter';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/internal/sync-alertops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Sincronização concluída: ${data.alertsFound} alertas processados, ${data.cardsCreated} cards criados.`);
      } else {
        toast.error(data.error || 'Falha na sincronização');
      }
    } catch (err) {
      toast.error('Erro de conexão ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className="bg-white border-r border-slate-200 flex flex-col z-50 relative shadow-sm"
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 bg-[#008542] rounded-md flex items-center justify-center text-[#ffcc00] font-bold italic text-lg shrink-0">
             T
          </div>
          {sidebarOpen && (
            <span className="font-bold tracking-tight text-slate-900 uppercase text-sm">
              AlertOps Manager
            </span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <SidebarItem icon={<BarChart3 size={20} />} label="Métricas" to="/dashboard/metrics" />
          <SidebarItem icon={<LayoutGrid size={20} />} label="Kanban Operacional" to="/dashboard/kanban" />
          <SidebarItem icon={<Bell size={20} />} label="Lembretes" to="/dashboard/reminders" />
          {user.role === 'ADMIN' && (
            <SidebarItem icon={<Settings size={20} />} label="Configurações" to="/dashboard/settings" />
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="bg-slate-50 rounded-lg p-3 flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                <span>Status Sync</span>
                <span className="text-[#008542]">Online</span>
              </div>
              <button 
                onClick={triggerSync}
                disabled={syncing}
                className="w-full py-1.5 bg-[#ffcc00] hover:bg-[#e6b800] text-[#002e1c] text-xs font-bold rounded shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncing ? <RefreshCw size={12} className="animate-spin" /> : null}
                SINCRONIZAR AGORA
              </button>
           </div>
           <button 
             onClick={handleLogout}
             className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors text-sm font-medium"
           >
             <LogOut size={18} /> Sair
           </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-lg font-bold text-slate-900 hidden sm:block">Gestão Operacional de Alertas</h1>
            <div className="hidden lg:flex gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded lowercaseFirst uppercase">12 Assigned</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Buscar ID ou Alerta..." 
                value={searchParams.get('q') || ''}
                onChange={(e) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    newParams.set('q', e.target.value);
                  } else {
                    newParams.delete('q');
                  }
                  setSearchParams(newParams);
                }}
                className="bg-slate-100 border-none rounded-full px-10 py-1.5 text-xs w-48 focus:ring-2 focus:ring-[#008542] outline-none"
              />
            </div>
            
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <NotificationCenter />
              <div className="text-right hidden sm:block ml-2">
                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{user.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold overflow-hidden">
                {user.name[0]}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto">
           <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, to }: { icon: React.ReactNode, label: string, to: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm font-medium
        ${isActive ? 'bg-[#f0f9f4] text-[#008542]' : 'text-slate-600 hover:bg-slate-50'}
      `}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
