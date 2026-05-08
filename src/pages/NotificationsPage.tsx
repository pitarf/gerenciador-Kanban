import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Check, 
  Clock, 
  MessageSquare, 
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  Trash2,
  X
} from 'lucide-react';
import { kanbanService } from '../services/kanbanService';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  const [search, setSearch] = useState(qParam);

  useEffect(() => {
    setSearch(qParam);
  }, [qParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams);
      if (search) {
        newParams.set('q', search);
      } else {
        newParams.delete('q');
      }
      if (newParams.get('q') !== searchParams.get('q')) {
        setSearchParams(newParams, { replace: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, searchParams, setSearchParams]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['all-notifications', search],
    queryFn: () => kanbanService.getNotifications({ search })
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => kanbanService.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: kanbanService.markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Todas as notificações marcadas como lidas');
    }
  });

  const filteredNotifications = notifications.filter((n: any) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return !n.is_read;
    if (filter === 'READ') return n.is_read;
    return true;
  });

  const stats = {
    unread: notifications.filter((n: any) => !n.is_read).length,
    total: notifications.length
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-2xl border border-emerald-100">
               <Bell className="text-[#008542]" size={32} />
            </div>
            Histórico de Notificações
          </h2>
          <p className="text-slate-500 mt-1">Acompanhe menções, atualizações de cards e lembretes importantes.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
             <div className="px-4 py-2 rounded-lg flex flex-col items-center text-emerald-600 bg-emerald-50">
               <span className="text-xl font-bold leading-tight">{stats.unread}</span>
               <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Não lidas</span>
             </div>
          </div>
          
          {stats.unread > 0 && (
            <button 
              onClick={() => markAllAsReadMutation.mutate()}
              className="px-4 py-2 bg-[#008542] text-white rounded-xl text-xs font-bold hover:bg-[#006a35] transition-all shadow-lg shadow-[#008542]/20 flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              LER TUDO
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar notificações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#008542] outline-none transition-all text-sm"
          />
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          <button 
            onClick={() => setFilter('ALL')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
              filter === 'ALL' ? "bg-white text-[#008542] shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Todas
          </button>
          <button 
            onClick={() => setFilter('UNREAD')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
              filter === 'UNREAD' ? "bg-white text-[#008542] shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Não Lidas
          </button>
          <button 
            onClick={() => setFilter('READ')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
              filter === 'READ' ? "bg-white text-[#008542] shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Lidas
          </button>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-[#008542] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification: any, idx: number) => (
              <motion.div
                key={`${notification.id}-${idx}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group relative bg-white rounded-2xl border p-5 transition-all hover:shadow-md flex items-start gap-4",
                  !notification.is_read ? "border-[#008542]/20 bg-emerald-50/10 shadow-sm" : "border-slate-100 opacity-80"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                  notification.title.includes('mencionou') ? "bg-emerald-100 text-[#008542]" : "bg-blue-100 text-blue-600"
                )}>
                  {notification.title.includes('mencionou') ? <MessageSquare size={18} /> : <Check size={18} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                      {notification.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                      <Clock size={10} />
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    {notification.message}
                  </p>

                  <div className="flex items-center gap-3">
                    {notification.link && (
                      <Link 
                        to={notification.link}
                        className="text-[11px] font-bold text-[#008542] hover:underline flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-lg transition-all hover:bg-emerald-100"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                      >
                        VER DETALHES
                        <ExternalLink size={12} />
                      </Link>
                    )}
                    
                    {!notification.is_read && (
                      <button 
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        className="text-[11px] font-bold text-slate-400 hover:text-[#008542] flex items-center gap-1.5"
                      >
                        MARCAR COMO LIDA
                      </button>
                    )}
                  </div>
                </div>

                {!notification.is_read && (
                  <div className="absolute top-6 right-6 w-2 h-2 bg-[#008542] rounded-full ring-4 ring-emerald-100/50" />
                )}
              </motion.div>
            ))
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
               <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bell size={32} className="text-slate-300" />
               </div>
               <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest">Nenhuma notificação</h3>
               <p className="text-slate-500 mt-1">Você está atualizado com todos os alertas.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
