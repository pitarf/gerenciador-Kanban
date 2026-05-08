import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  AlertCircle
} from 'lucide-react';
import { reminderService } from '../services/reminderService';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DONE'>('PENDING');
  
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

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['all-reminders'],
    queryFn: () => reminderService.getReminders()
  });

  const toggleReminderMutation = useMutation({
    mutationFn: ({ id, is_done }: { id: string, is_done: boolean }) => 
      reminderService.updateReminder(id, { is_done }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-reminders'] });
    }
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (id: string) => reminderService.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-reminders'] });
      toast.success('Lembrete excluído');
    }
  });

  const filteredReminders = reminders.filter((r: any) => {
    const matchesFilter = 
      filter === 'ALL' ? true : 
      filter === 'PENDING' ? !r.is_done : r.is_done;
    
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
                         (r.card?.title || '').toLowerCase().includes(search.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const stats = {
    pending: reminders.filter((r: any) => !r.is_done).length,
    completed: reminders.filter((r: any) => r.is_done).length,
    total: reminders.length
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Bell className="text-[#008542]" size={32} />
            Meus Lembretes
          </h2>
          <p className="text-slate-500 mt-1">Gerencie suas tarefas pendentes e alertas monitorados.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
           <StatCard label="Pendentes" value={stats.pending} color="text-amber-600 bg-amber-50" />
           <StatCard label="Concluídos" value={stats.completed} color="text-emerald-600 bg-emerald-50" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar lembretes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#008542] outline-none transition-all text-sm"
          />
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          <FilterButton active={filter === 'PENDING'} onClick={() => setFilter('PENDING')} label="Pendentes" />
          <FilterButton active={filter === 'DONE'} onClick={() => setFilter('DONE')} label="Concluídos" />
          <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="Todos" />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredReminders.length > 0 ? (
            filteredReminders.map((reminder: any, idx: number) => (
              <motion.div
                key={`${reminder.id}-${idx}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group relative bg-white rounded-2xl border p-5 transition-all hover:shadow-md",
                  reminder.is_done ? "border-slate-100 opacity-60" : "border-slate-200 hover:border-[#008542]/30"
                )}
              >
                <div className="flex items-start gap-5">
                  {/* Status Toggle */}
                  <button 
                    onClick={() => toggleReminderMutation.mutate({ id: reminder.id, is_done: !reminder.is_done })}
                    className={cn(
                      "mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                      reminder.is_done 
                        ? "bg-[#008542] border-[#008542] text-white" 
                        : "border-slate-200 text-transparent hover:border-[#008542]"
                    )}
                  >
                    <CheckCircle2 size={16} />
                  </button>

                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className={cn(
                          "text-lg font-bold tracking-tight truncate",
                          reminder.is_done ? "text-slate-400 line-through" : "text-slate-900"
                        )}>
                          {reminder.title}
                        </h3>
                        {reminder.description && (
                          <p className="text-slate-500 text-sm mt-1 line-clamp-2">{reminder.description}</p>
                        )}
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={() => deleteReminderMutation.mutate(reminder.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Excluir lembrete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-md",
                        isOverdue(reminder.due_at) && !reminder.is_done 
                          ? "bg-red-50 text-red-600" 
                          : "bg-slate-100 text-slate-500"
                      )}>
                        <Clock size={14} />
                        {format(new Date(reminder.due_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        <span className="text-[10px] opacity-70">
                          ({formatDistanceToNow(new Date(reminder.due_at), { addSuffix: true, locale: ptBR })})
                        </span>
                      </div>

                      {reminder.card && (
                        <Link 
                          to={`/dashboard/kanban?cardId=${reminder.card.alertops_alert?.alertops_thread_id || reminder.card.id}`}
                          className="flex items-center gap-2 text-xs font-bold text-[#008542] hover:underline bg-[#008542]/5 px-2 py-1 rounded-md"
                        >
                          <AlertCircle size={14} />
                          Alerta #{reminder.card.alertops_alert?.alertops_thread_id || reminder.card.id.slice(-6)}
                          <ExternalLink size={12} />
                        </Link>
                      )}

                      {reminder.user_id !== currentUser.id && (
                        <div className="text-[10px] font-bold text-blue-600 border border-blue-100 bg-blue-50 px-2 py-0.5 rounded uppercase">
                          Mencionado por {reminder.user?.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
               <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bell size={32} className="text-slate-300" />
               </div>
               <h3 className="text-lg font-bold text-slate-900">Nenhum lembrete encontrado</h3>
               <p className="text-slate-500 mt-1">Você está em dia com suas notificações!</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={cn("px-4 py-2 rounded-lg flex flex-col items-center", color)}>
      <span className="text-xl font-bold leading-tight">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
        active ? "bg-white text-[#008542] shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
      )}
    >
      {label}
    </button>
  );
}

function isOverdue(date: string | Date) {
  return new Date(date) < new Date();
}
