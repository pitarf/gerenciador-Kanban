import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Trash2, Clock, MessageSquare, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { kanbanService } from '../services/kanbanService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', search, fromDate, toDate],
    queryFn: () => kanbanService.getNotifications({ search, from: fromDate, to: toDate }),
    refetchInterval: search || fromDate || toDate ? false : 10000 // Disable auto-poll when searching
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => kanbanService.markNotificationAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: kanbanService.markAllNotificationsAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-xl transition-all active:scale-95",
          isOpen ? "bg-[#008542] text-white shadow-lg" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
        )}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                Notificações
                {unreadCount > 0 && <span className="bg-[#008542] text-[#ffcc00] px-1.5 py-0.5 rounded text-[8px]">{unreadCount} novas</span>}
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn("text-[10px] font-bold transition-colors", showFilters ? "text-[#008542]" : "text-slate-400 hover:text-slate-600")}
                >
                  Filtrar
                </button>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-[10px] font-bold text-[#008542] hover:underline"
                  >
                    Ler tudo
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="p-3 bg-white border-b border-slate-100 flex flex-col gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Bell size={12} className="rotate-12" />
                  </span>
                  <input 
                    type="text" 
                    placeholder="Pesquisar..." 
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-xs focus:ring-1 focus:ring-[#008542] transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">De</label>
                    <input 
                      type="date" 
                      className="bg-slate-100 border-none rounded-lg text-[10px] py-1 px-2 focus:ring-1 focus:ring-[#008542]"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Até</label>
                    <input 
                      type="date" 
                      className="bg-slate-100 border-none rounded-lg text-[10px] py-1 px-2 focus:ring-1 focus:ring-[#008542]"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
                {(search || fromDate || toDate) && (
                  <button 
                    onClick={() => { setSearch(''); setFromDate(''); setToDate(''); }}
                    className="text-[9px] font-bold text-red-500 hover:underline text-right"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="p-10 text-center flex flex-col items-center gap-3">
                   <div className="w-5 h-5 border-2 border-[#008542] border-t-transparent rounded-full animate-spin" />
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Carregando...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell size={20} className="text-slate-300" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nada encontrado</p>
                  <p className="text-[10px] text-slate-300 mt-1 italic">Tente mudar os filtros.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification: any, idx: number) => (
                    <div 
                      key={`${notification.id}-${idx}`}
                      className={cn(
                        "p-4 transition-colors hover:bg-slate-50 relative group",
                        !notification.is_read && "bg-emerald-50/40"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          notification.title.includes('mencionou') ? "bg-emerald-100 text-[#008542]" : "bg-blue-100 text-blue-600"
                        )}>
                          {notification.title.includes('mencionou') ? <MessageSquare size={14} /> : <Check size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-black text-slate-900 uppercase truncate">
                              {notification.title}
                            </span>
                            <span className="text-[8px] text-slate-400 flex items-center gap-1 font-medium whitespace-nowrap">
                              <Clock size={8} />
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-tight mb-2">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center gap-2">
                             {notification.link && (
                               <Link 
                                 to={notification.link}
                                 className="text-[10px] font-bold text-[#008542] hover:underline flex items-center gap-1"
                                 onClick={() => {
                                   markAsReadMutation.mutate(notification.id);
                                   setIsOpen(false);
                                 }}
                               >
                                 Ver detalhes
                                 <ExternalLink size={10} />
                               </Link>
                             )}
                             {!notification.is_read && (
                               <button 
                                 onClick={() => markAsReadMutation.mutate(notification.id)}
                                 className="text-[10px] font-bold text-slate-400 hover:text-[#008542] flex items-center gap-1 ml-auto"
                               >
                                 Marcar como lida
                               </button>
                             )}
                          </div>
                        </div>
                      </div>
                      {!notification.is_read && (
                        <div className="absolute top-4 right-4 w-1.5 h-1.5 bg-[#008542] rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
              <button className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors">
                Histórico completo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
