import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Fix for quill-mention registration
import * as MentionModule from 'quill-mention';
import 'quill-mention/dist/quill.mention.css';

const Mention = (MentionModule as any).Mention || (MentionModule as any).default || MentionModule;
const MentionBlot = (MentionModule as any).MentionBlot || (MentionModule as any).default?.MentionBlot || (Mention as any).MentionBlot;

// Important: Set window.Quill before any potential auto-registration
if (typeof window !== 'undefined') {
  (window as any).Quill = Quill;
}

// Ensure the mention blot is registered to avoid ParchmentError
const registerMentionParts = () => {
  if (Mention) {
    Quill.register('modules/mention', Mention, true);
  }
  
  try {
    const Embed = Quill.import('blots/embed');
    class CustomMentionBlot extends (Embed as any) {
      static create(data: any) {
        const node = super.create();
        node.setAttribute('data-id', data.id);
        node.setAttribute('data-value', data.value);
        node.setAttribute('data-denotation-char', data.denotationChar);
        
        const denotationSpan = document.createElement('span');
        denotationSpan.className = 'ql-mention-denotation-char';
        denotationSpan.innerText = data.denotationChar;
        node.appendChild(denotationSpan);
        node.appendChild(document.createTextNode(data.value));
        
        return node;
      }
      static value(node: any) {
        return {
          id: node.getAttribute('data-id'),
          value: node.getAttribute('data-value'),
          denotationChar: node.getAttribute('data-denotation-char')
        };
      }
    }
    (CustomMentionBlot as any).blotName = 'mention';
    (CustomMentionBlot as any).tagName = 'span';
    (CustomMentionBlot as any).className = 'mention';
    Quill.register('formats/mention', CustomMentionBlot, true);
  } catch (e) {
    console.error('Failed to register custom mention blot:', e);
  }
};

registerMentionParts();
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Filter, Calendar, AlertCircle, ChevronRight, Clock,
  ExternalLink, User as UserIcon, MessageSquare, History, CheckSquare, X, Link, Bell,
  LayoutGrid, Send, Paperclip, MoreHorizontal, Edit2, Trash2, Image as ImageIcon, 
  FileText, FileArchive, Music, Video, FileBarChart2 as FileSpreadsheet, FileQuestion,
  ArrowRight, RefreshCw, Layers, CheckCircle2
} from 'lucide-react';
import { kanbanService } from '../services/kanbanService';
import { reminderService } from '../services/reminderService';
import { Card, CardStatus } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';

const getCriticalityColors = (criticality?: string) => {
  if (!criticality) return { border: 'border-l-slate-200', badge: 'bg-slate-50 text-slate-500', text: 'text-slate-500' };
  
  const norm = criticality.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  switch (norm) {
    case 'critico':
    case 'critica':
      return { border: 'border-l-purple-500', badge: 'bg-purple-50 text-purple-600', text: 'text-purple-600' };
    case 'alto':
    case 'alta':
      return { border: 'border-l-red-500', badge: 'bg-red-50 text-red-600', text: 'text-red-600' };
    case 'medio':
    case 'media':
      return { border: 'border-l-yellow-400', badge: 'bg-yellow-50 text-yellow-600', text: 'text-yellow-600' };
    case 'baixo':
    case 'baixa':
      return { border: 'border-l-green-500', badge: 'bg-green-50 text-green-600', text: 'text-green-600' };
    default:
      return { border: 'border-l-slate-200', badge: 'bg-slate-50 text-slate-500', text: 'text-slate-500' };
  }
};

const getFriendlyLinkLabel = (url: string) => {
  if (!url) return '';
  const lowUrl = url.toLowerCase();
  if (lowUrl.includes('powerbi.com')) return 'Ir para o Power BI';
  if (lowUrl.includes('grafana')) return 'Ir para o Grafana';
  if (lowUrl.includes('alertops')) return 'Ir para o AlertOps';
  return url;
};

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';

  const [filter, setFilter] = useState(qParam);
  const [debouncedFilter, setDebouncedFilter] = useState(qParam);
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedCriticality, setSelectedCriticality] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [groupBy, setGroupBy] = useState<'status' | 'group'>('status');
  const [activeView, setActiveView] = useState<'kanban' | 'charts' | 'agenda'>('kanban');
  const [isSyncing, setIsSyncing] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/internal/sync-alertops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Sincronização concluída: ${data.alertsFound} alertas processados`);
        queryClient.invalidateQueries({ queryKey: ['cards'] });
      } else {
        toast.error('Erro ao sincronizar: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      toast.error('Erro de conexão ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setFilter(qParam);
  }, [qParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
      const newParams = new URLSearchParams(searchParams);
      if (filter) {
        newParams.set('q', filter);
      } else {
        newParams.delete('q');
      }
      // Only update URL if it's different to avoid loops
      if (newParams.get('q') !== searchParams.get('q')) {
        setSearchParams(newParams, { replace: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [filter, searchParams, setSearchParams]);

  const cardIdParam = searchParams.get('cardId');

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: kanbanService.getStatuses });
  const { data: integrations = [] } = useQuery({ queryKey: ['integrations'], queryFn: kanbanService.getIntegrations });
  const { data: alertGroups = [] } = useQuery({ queryKey: ['alert-groups'], queryFn: kanbanService.getGroups });
  const { data: cards = [], isLoading, isError, error } = useQuery({ 
    queryKey: ['cards', debouncedFilter, fromDate, toDate, selectedCriticality, selectedStatus, selectedTag, selectedIntegration], 
    queryFn: () => kanbanService.getCards({ 
      search: debouncedFilter, 
      from: fromDate, 
      to: toDate,
      criticidade: selectedCriticality,
      statusId: selectedStatus,
      tag: selectedTag,
      integracao: selectedIntegration
    }) 
  });

  useEffect(() => {
    if (cardIdParam) {
      const cardInList = cards.find((c: any) => 
        String(c.id) === String(cardIdParam) || 
        String(c.alertops_alert?.alertops_thread_id) === String(cardIdParam)
      );

      if (cardInList) {
        // Synchronize selected card with the latest data from the list
        if (!selectedCard || selectedCard.id !== cardInList.id || selectedCard.group_id !== cardInList.group_id || selectedCard.status_id !== cardInList.status_id) {
          setSelectedCard(cardInList);
        }
      } else if (!selectedCard || (String(selectedCard.id) !== String(cardIdParam) && String(selectedCard.alertops_alert?.alertops_thread_id) !== String(cardIdParam))) {
        // If not in the current visible cards list, fetch individual card data
        kanbanService.getCard(cardIdParam)
          .then(card => {
            if (searchParams.get('cardId') === cardIdParam) {
              setSelectedCard(card);
            }
          })
          .catch(err => console.error('Erro ao abrir card da notificação:', err));
      }
    } else if (selectedCard) {
      setSelectedCard(null);
    }
  }, [cardIdParam, cards, searchParams, selectedCard?.id, selectedCard?.group_id, selectedCard?.status_id]); 

  const handleCardClick = (card: Card) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('cardId', card.id);
    setSearchParams(newParams);
  };

  const closeCardModal = () => {
    setSelectedCard(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('cardId');
    setSearchParams(newParams, { replace: true });
  };

  const moveMutation = useMutation({
    mutationFn: ({ cardId, statusId }: { cardId: string, statusId: string }) => kanbanService.updateCardStatus(cardId, statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Card movimentado com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao mover card');
    }
  });

  const groupMutation = useMutation({
    mutationFn: async ({ cardId, groupId }: { cardId: string, groupId: string | null }) => {
      const card = cards.find((c: any) => c.id === cardId);
      if (card?.group_id) {
        await kanbanService.removeCardsFromGroup(card.group_id, [cardId]);
      }
      if (groupId && groupId !== 'no-group') {
        await kanbanService.addCardsToGroup(groupId, [cardId]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['alert-groups'] });
      toast.success('Balde do card atualizado');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar balde');
    }
  });

  // Now we use cards directly as they are filtered by server
  const filteredCards = cards;

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => kanbanService.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-groups'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Balde excluído com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir balde');
    }
  });

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (groupBy === 'status') {
      moveMutation.mutate({ cardId: draggableId, statusId: destination.droppableId });
    } else {
      groupMutation.mutate({ cardId: draggableId, groupId: destination.droppableId });
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500 font-medium h-full flex items-center justify-center">Carregando quadro operacional...</div>;
  if (isError) return <div className="p-8 text-center text-red-500 h-full flex items-center justify-center">Erro ao carregar cards: {(error as any)?.message}</div>;

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa]">
      {/* Planner-style Sub-header */}
      <div className="px-6 py-2 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-[#008542] rounded flex items-center justify-center">
                  <LayoutGrid size={18} className="text-white" />
               </div>
               <div>
                  <h1 className="text-sm font-bold text-slate-800 leading-none mb-1">AlertOps Board | Transpetro</h1>
                  <div className="flex items-center gap-1">
                     <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronização Ativa</span>
                  </div>
               </div>
            </div>
            
            <nav className="flex items-center gap-4 ml-4">
               <button 
                 onClick={() => setActiveView('kanban')}
                 className={cn(
                   "text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all", 
                   activeView === 'kanban' ? "text-[#008542] border-[#008542]" : "text-slate-400 border-transparent hover:text-[#008542]"
                 )}
               >
                 Quadro
               </button>
               <button 
                 onClick={() => setActiveView('charts')}
                 className={cn(
                   "text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all", 
                   activeView === 'charts' ? "text-[#008542] border-[#008542]" : "text-slate-400 border-transparent hover:text-[#008542]"
                 )}
               >
                 Gráficos
               </button>
               <button 
                 onClick={() => setActiveView('agenda')}
                 className={cn(
                   "text-[10px] font-bold uppercase tracking-widest pb-1 border-b-2 transition-all", 
                   activeView === 'agenda' ? "text-[#008542] border-[#008542]" : "text-slate-400 border-transparent hover:text-[#008542]"
                 )}
               >
                 Agenda
               </button>
            </nav>
         </div>

         <div className="flex items-center gap-2">
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 border rounded-md text-[10px] font-bold transition-all uppercase tracking-widest",
                isSyncing 
                  ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#008542] hover:text-[#008542]"
              )}
            >
               <RefreshCw size={14} className={cn(isSyncing && "animate-spin text-[#008542]")} />
               {isSyncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR ALERTOPS'}
            </button>

            <div className="relative">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Filtrar por nome ou ID..."
                 value={filter}
                 onChange={(e) => setFilter(e.target.value)}
                 className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs w-60 focus:ring-1 focus:ring-[#008542] outline-none"
               />
            </div>
             <div className="relative">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border rounded-md text-[10px] font-bold transition-all uppercase tracking-widest",
                    showFilters || fromDate || toDate || selectedCriticality || selectedStatus /* || selectedTag */ || selectedIntegration
                      ? "bg-[#008542] text-white border-[#008542]" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                   <Filter size={14} />
                   FILTRO
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div 
                      key="kanban-filters"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] p-4 flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Filtros Avançados</span>
                        {(fromDate || toDate || selectedCriticality || selectedStatus /* || selectedTag */ || selectedIntegration) && (
                          <button 
                            onClick={() => { 
                              setFromDate(''); 
                              setToDate(''); 
                              setSelectedCriticality('');
                              setSelectedStatus('');
                              // setSelectedTag('');
                              setSelectedIntegration('');
                            }}
                            className="text-[9px] font-bold text-red-500 hover:underline"
                          >
                            Limpar Tudo
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Período de Criação</label>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="date" 
                              value={fromDate}
                              onChange={(e) => setFromDate(e.target.value)}
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none"
                            />
                            <input 
                              type="date" 
                              value={toDate}
                              onChange={(e) => setToDate(e.target.value)}
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Criticidade</label>
                            <select 
                              value={selectedCriticality}
                              onChange={(e) => setSelectedCriticality(e.target.value)}
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none appearance-none"
                            >
                              <option value="">Todas</option>
                              <option value="CRITICA">CRITICA</option>
                              <option value="ALTA">ALTA</option>
                              <option value="MEDIA">MEDIA</option>
                              <option value="BAIXA">BAIXA</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Status</label>
                            <select 
                              value={selectedStatus}
                              onChange={(e) => setSelectedStatus(e.target.value)}
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none appearance-none"
                            >
                              <option value="">Todos</option>
                              {statuses.map((s, idx) => (
                                <option key={`${s.id}-${idx}`} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Integração</label>
                          <select 
                            value={selectedIntegration}
                            onChange={(e) => setSelectedIntegration(e.target.value)}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none appearance-none"
                          >
                            <option value="">Todas</option>
                            {integrations.map((int, idx) => (
                              <option key={`int-${int}-${idx}`} value={int}>{int}</option>
                            ))}
                          </select>
                        </div>

{/* 
                         <div className="flex flex-col gap-1.5">
                           <label className="text-[9px] font-bold text-slate-400 uppercase">Etiqueta (Tag)</label>
                           <input 
                             type="text" 
                             placeholder="Nome da etiqueta..."
                             value={selectedTag}
                             onChange={(e) => setSelectedTag(e.target.value)}
                             className="text-[10px] bg-slate-50 border border-slate-200 rounded px-3 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none"
                           />
                         </div>
                        */}
                      </div>

                      <button 
                        onClick={() => setShowFilters(false)}
                        className="w-full py-2 bg-[#008542] text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-green-800 transition-colors mt-2"
                      >
                        Pronto
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
             <button 
               onClick={() => setGroupBy(groupBy === 'status' ? 'group' : 'status')}
               className={cn(
                 "px-4 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase tracking-widest",
                 groupBy === 'group' ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-[#008542] text-white hover:bg-green-800"
               )}
             >
                {groupBy === 'group' ? 'Ver por Status' : 'Visão Agrupamento'}
             </button>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6 scrollbar-green">
        {activeView === 'kanban' && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 h-full min-w-max pb-4">
              {groupBy === 'status' ? (
                statuses.map((status, idx) => (
                  <KanbanColumn 
                    key={`${status.id || 'status-col'}-${idx}`} 
                    status={status} 
                    cards={filteredCards.filter(c => c.status_id === status.id)} 
                    onCardClick={handleCardClick}
                  />
                ))
              ) : (
                alertGroups.map((group, idx) => (
                  <KanbanColumn 
                    key={`${group.id || 'group'}-${idx}`} 
                    title={group.name}
                    id={group.id}
                    cards={filteredCards.filter(c => c.group_id === group.id)} 
                    onCardClick={handleCardClick}
                    onDelete={() => setGroupToDelete({ id: group.id, name: group.name })}
                  />
                ))
              )}
            </div>
          </DragDropContext>
        )}

        {activeView === 'charts' && (
          <ChartsView cards={cards} statuses={statuses} />
        )}

        {activeView === 'agenda' && (
          <AgendaView cards={cards} onCardClick={handleCardClick} />
        )}
      </div>

      {/* Quick Stats Footer */}
      <footer className="h-12 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex gap-6">
          {/* MTTR Tooltip */}
          <div className="group relative flex items-center gap-2 cursor-help">
            <div className="w-2 h-2 rounded-full bg-[#008542]"></div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">MTTR Médio: 18min</span>
            <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-xl border border-slate-800 translate-y-1 group-hover:translate-y-0">
              <p className="font-bold mb-0.5 text-emerald-400">Mean Time To Resolution</p>
              <p className="text-slate-400 text-[9px]">Média de tempo entre a abertura e o fechamento dos cards.</p>
              <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-900"></div>
            </div>
          </div>

          {/* SLA Tooltip */}
          <div className="group relative flex items-center gap-2 cursor-help">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Conformidade SLA: 94%</span>
            <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-xl border border-slate-800 translate-y-1 group-hover:translate-y-0">
              <p className="font-bold mb-0.5 text-amber-400">Service Level Agreement</p>
              <p className="text-slate-400 text-[9px]">Percentual de alertas atendidos dentro do prazo estipulado.</p>
              <div className="absolute top-full left-4 border-8 border-transparent border-t-slate-900"></div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400">
           <span className="flex items-center gap-1">
             <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
             Servidor: Online
           </span>
        </div>
      </footer>

      {/* Card Detail Drawer */}
      <AnimatePresence>
        {selectedCard && (
          <CardDetailDrawer 
            card={selectedCard} 
            onClose={closeCardModal}
            groups={alertGroups}
            allCards={filteredCards}
            onDeleteGroup={(id, name) => setGroupToDelete({ id, name })}
            onCardClick={handleCardClick}
          />
        )}
        {groupToDelete && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
            >
              <div className="p-6">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <AlertCircle size={24} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Excluir Agrupamento?</h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Você está prestes a excluir o balde <span className="font-bold text-slate-700">"{groupToDelete.name}"</span>. 
                  <br /><br />
                  <span className="text-red-500 font-medium italic text-xs">Atenção:</span> Esta ação é permanente. Os alertas vinculados <span className="font-bold">não serão excluídos</span>, eles apenas ficarão sem balde.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setGroupToDelete(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      deleteGroupMutation.mutate(groupToDelete.id);
                      setGroupToDelete(null);
                      if (selectedCard) closeCardModal();
                    }}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-200 active:scale-95"
                  >
                    Excluir Balde
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KanbanColumn({ status, cards, onCardClick, title, id, onDelete }: { status?: CardStatus, cards: Card[], onCardClick: (card: Card) => void, title?: string, id?: string, onDelete?: () => void }) {
  const columnTitle = title || status?.name || 'Sem Título';
  const droppableId = id || status?.id || 'unknown';

  return (
    <div className="w-[300px] flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between mb-4 px-1 relative z-10">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
           <h2 className="text-sm font-bold text-slate-700 truncate" title={columnTitle}>{columnTitle}</h2>
           <span className="text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 shrink-0">
             {cards.length}
           </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onDelete && (
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-300 hover:text-red-500 transition-all hover:bg-slate-50 rounded-md group active:scale-90"
              title="Excluir Balde"
            >
              <Trash2 size={15} className="transition-transform" />
            </button>
          )}
          <button 
            type="button"
            className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
          >
             <ChevronRight size={16} className="rotate-90" />
          </button>
        </div>
      </div>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={cn(
              "flex-1 space-y-3 min-h-[200px] transition-all rounded-lg pb-4",
              snapshot.isDraggingOver ? "bg-[#008542]/5 ring-1 ring-[#008542]/10" : "bg-transparent"
            )}
          >
            {/* Quick Add Placeholder */}
            <button className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-[#008542] hover:text-[#008542] transition-all flex items-center justify-center gap-2 mb-2 bg-white/50 group">
               <X className="rotate-45 text-slate-300 group-hover:text-[#008542] transition-colors" size={14} />
               <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Tarefa</span>
            </button>
            {cards.map((card, index) => (
              <Draggable key={`${card.id}-${index}`} draggableId={String(card.id)} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onCardClick(card)}
                    className="outline-none"
                    style={{ ...provided.draggableProps.style }}
                  >
                    <KanbanCard card={card} isDragging={snapshot.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function KanbanCard({ card, isDragging }: { card: Card, isDragging: boolean }) {
  const isOverdue = card.due_at && new Date(card.due_at) < new Date();
  const colors = getCriticalityColors(card.criticidade);

  return (
    <div className={cn(
      "bg-white p-4 rounded-lg shadow-sm border-l-4 cursor-grab hover:shadow-md transition-all group",
      colors.border,
      isDragging && "shadow-xl ring-2 ring-[#008542]/20 scale-105 z-50",
    )}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-1">
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase inline-block w-fit",
            colors.badge
          )}>
            {card.criticidade || 'Normal'}
          </span>
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
            {card.alertops_alert?.source_identifier || '-'} | {card.alertops_alert?.integration_name || '-'}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono tracking-tighter">#{card.alertops_alert?.alertops_thread_id ? card.alertops_alert.alertops_thread_id.slice(-6) : card.id.slice(-6)}</span>
      </div>

{/*
      <div className="flex flex-wrap gap-1 mb-2">
        {card.labels?.map((label, idx) => (
          <div 
            key={`${label.id || 'label'}-${idx}`} 
            className="h-1.5 w-6 rounded-full" 
            style={{ backgroundColor: label.color }}
            title={label.name}
          />
        ))}
      </div>
      */}

      <p 
        className="text-sm font-black text-slate-800 leading-snug mb-3 group-hover:text-[#008542] transition-colors break-words line-clamp-2 min-h-[2.5rem] overflow-hidden"
        title={card.message_text || card.title}
      >
        {card.title}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
           {card._count?.checklists ? (
             <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold" title="Progresso do Checklist">
               <CheckSquare size={12} className={card.checklist_done_count === card._count.checklists ? "text-[#008542]" : ""} />
               <span>{card.checklist_done_count}/{card._count.checklists}</span>
             </div>
           ) : null}
           {card._count?.comments ? (
             <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
               <MessageSquare size={12} />
               <span>{card._count.comments}</span>
             </div>
           ) : null}
        </div>
        
        <div className="flex items-center gap-2">
           {card.due_at && (
             <div className={cn(
               "flex items-center gap-1 px-1.5 py-0.5 rounded border",
               isOverdue ? "bg-red-50 border-red-100 text-red-600" : "bg-amber-50 border-amber-100 text-amber-600"
             )}>
               <Calendar size={10} />
               <span className="text-[10px] font-bold">
                 {format(new Date(card.due_at), 'dd/MM/yy HH:mm')}
               </span>
             </div>
           )}
           <div 
             className={cn(
               "w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-bold uppercase",
               card.assigned_user ? "bg-[#008542] text-white" : "bg-slate-100 text-slate-500"
             )}
             title={card.assigned_user ? `Responsável: ${card.assigned_user.name}` : `Proprietário: ${card.owner_name}`}
           >
             {(card.assigned_user?.name || card.owner_name || 'U').charAt(0)}
           </div>
        </div>
      </div>
    </div>
  );
}

function RemindersTab({ cardId, users, prefilledTitle, onClearPrefill }: { cardId: string, users: any[], prefilledTitle?: string, onClearPrefill?: () => void }) {
  const queryClient = useQueryClient();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', cardId],
    queryFn: () => reminderService.getReminders(cardId)
  });

  const [newReminderTitle, setNewReminderTitle] = useState('');

  useEffect(() => {
    if (prefilledTitle) {
      setNewReminderTitle(prefilledTitle);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefilledTitle, onClearPrefill]);

  const [selectedTime, setSelectedTime] = useState<number | string>(30);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [customRelativeValue, setCustomRelativeValue] = useState('15');
  const [customRelativeUnit, setCustomRelativeUnit] = useState<'m' | 'h' | 'd'>('m');
  const [customDate, setCustomDate] = useState('');

  const addReminderMutation = useMutation({
    mutationFn: (data: any) => reminderService.createReminder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', cardId] });
      setNewReminderTitle('');
      setSelectedMentions([]);
      toast.success('Lembrete agendado!');
    }
  });

  const toggleReminderMutation = useMutation({
    mutationFn: ({ id, is_done }: any) => reminderService.updateReminder(id, { is_done }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', cardId] });
    }
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (id: string) => reminderService.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', cardId] });
      setConfirmDeleteId(null);
    }
  });

  const handleAddReminder = () => {
    if (!newReminderTitle.trim()) return;
    
    let dueAt = new Date();
    if (selectedTime === 'shift') {
      const now = new Date();
      const hour = now.getHours();
      if (hour < 7) {
        dueAt.setHours(7, 0, 0, 0);
      } else if (hour < 19) {
        dueAt.setHours(19, 0, 0, 0);
      } else {
        dueAt.setDate(dueAt.getDate() + 1);
        dueAt.setHours(7, 0, 0, 0);
      }
    } else if (selectedTime === 'custom_relative') {
      const value = parseInt(customRelativeValue) || 15;
      const multiplier = customRelativeUnit === 'm' ? 1 : customRelativeUnit === 'h' ? 60 : 1440;
      dueAt = new Date(Date.now() + value * multiplier * 60 * 1000);
    } else if (selectedTime === 'custom_absolute') {
      if (!customDate) {
        toast.error('Selecione uma data e hora');
        return;
      }
      dueAt = new Date(customDate);
    } else {
      dueAt = new Date(Date.now() + Number(selectedTime) * 60 * 1000);
    }

    addReminderMutation.mutate({
      card_id: cardId,
      title: newReminderTitle,
      due_at: dueAt,
      mentions: selectedMentions
    });
  };

  const toggleMention = (userId: string) => {
    setSelectedMentions(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Novo Lembrete</h4>
        <div className="space-y-4">
          <div className="relative">
            <Bell size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              value={newReminderTitle}
              onChange={(e) => setNewReminderTitle(e.target.value)}
              placeholder="O que precisa ser verificado?"
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#008542] outline-none transition-all"
            />
          </div>
          
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Notificar também:</p>
            <div className="flex flex-wrap gap-2">
               <button 
                type="button"
                onClick={() => toggleMention('todos')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-bold border transition-all flex items-center gap-1",
                  selectedMentions.includes('todos') 
                    ? "bg-blue-600 border-blue-600 text-white" 
                    : "bg-white border-slate-200 text-slate-500 hover:border-blue-200"
                )}
              >
                @todos
              </button>
              {users.filter(u => u.id !== JSON.parse(localStorage.getItem('user') || '{}').id).map((u, idx) => (
                <button 
                  key={`${u.id || 'user-mention'}-${idx}`}
                  type="button"
                  onClick={() => toggleMention(u.id)}
                  className={cn(
                    "px-2 py-1 rounded text-[9px] font-bold border transition-all",
                    selectedMentions.includes(u.id) 
                      ? "bg-emerald-600 border-emerald-600 text-white" 
                      : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200"
                  )}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: '30m', value: 30 },
              { label: '1h', value: 60 },
              { label: '2h', value: 120 },
              { label: '5h', value: 300 },
              { label: 'Turno', value: 'shift' },
              { label: 'Daqui a...', value: 'custom_relative' },
              { label: 'Calendário', value: 'custom_absolute' },
            ].map((time, idx) => (
              <button 
                key={`${time.value}-${idx}`}
                type="button"
                onClick={() => setSelectedTime(time.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                  selectedTime === time.value 
                    ? "bg-[#008542] text-white border-[#008542]" 
                    : "bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200"
                )}
              >
                {time.label}
              </button>
            ))}
          </div>

          {selectedTime === 'custom_relative' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <input 
                type="number" 
                value={customRelativeValue}
                onChange={(e) => setCustomRelativeValue(e.target.value)}
                className="w-16 px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-[#008542]"
                min="1"
              />
              <select 
                value={customRelativeUnit}
                onChange={(e) => setCustomRelativeUnit(e.target.value as any)}
                className="px-2 py-1.5 text-[10px] font-bold border border-slate-200 rounded-md bg-white uppercase outline-none focus:ring-1 focus:ring-[#008542]"
              >
                <option value="m">Minutos</option>
                <option value="h">Horas</option>
                <option value="d">Dias</option>
              </select>
            </div>
          )}

          {selectedTime === 'custom_absolute' && (
            <div className="animate-in fade-in slide-in-from-top-1">
              <input 
                type="datetime-local" 
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-[#008542]"
              />
            </div>
          )}
          <button 
            onClick={handleAddReminder}
            disabled={addReminderMutation.isPending || !newReminderTitle.trim()}
            className="w-full py-2 bg-[#008542] text-white rounded-lg text-xs font-bold hover:bg-[#006a35] transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200"
          >
            {addReminderMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Bell size={14} />}
            AGENDAR AGORA
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lembretes Aguardando</h4>
        {reminders.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Bell size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Nenhum lembrete para este card</p>
          </div>
        ) : (
          reminders.map((reminder: any, idx: number) => (
            <div 
              key={`${reminder.id}-${idx}`}
                  className={cn(
                    "group flex items-center gap-4 bg-white p-3 rounded-xl border transition-all",
                    reminder.is_done ? "opacity-60 border-slate-100" : "border-slate-200 hover:border-[#008542]/30"
                  )}
                >
              <button 
                onClick={() => toggleReminderMutation.mutate({ id: reminder.id, is_done: !reminder.is_done })}
                className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                  reminder.is_done ? "bg-[#008542] border-[#008542] text-white" : "border-slate-300 text-transparent"
                )}
              >
                 <ArrowRight size={12} className={reminder.is_done ? "" : "hidden"} />
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-bold truncate",
                  reminder.is_done ? "text-slate-400 line-through" : "text-slate-700"
                )}>
                  {reminder.title}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Calendar size={10} />
                  {formatDistanceToNow(new Date(reminder.due_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {confirmDeleteId === reminder.id ? (
                  <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2">
                    <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Excluir?</span>
                    <button 
                      onClick={() => deleteReminderMutation.mutate(reminder.id)}
                      className="p-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                      <CheckCircle2 size={12} />
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-1 bg-slate-200 text-slate-500 rounded-md hover:bg-slate-300 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmDeleteId(reminder.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GroupsTab({ card, groups, onRefresh, allCards, onDeleteGroup, onCardClick }: { card: any, groups: any[], onRefresh: () => void, allCards: any[], onDeleteGroup?: (id: string, name: string) => void, onCardClick: (card: any) => void }) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const groupCards = allCards.filter(c => c.group_id === card.group_id);

  const createGroupMutation = useMutation({
    mutationFn: (data: any) => kanbanService.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-groups'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setIsCreating(false);
      setNewGroupName('');
      setNewGroupDesc('');
      toast.success('Grupo criado com sucesso');
      onRefresh();
    }
  });

  const addToGroupMutation = useMutation({
    mutationFn: (groupId: string) => kanbanService.addCardsToGroup(groupId, [card.id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-groups'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Card adicionado ao grupo');
      onRefresh();
    }
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: () => kanbanService.removeCardsFromGroup(card.group_id, [card.id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-groups'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Card removido do grupo');
      onRefresh();
    }
  });

  return (
    <div className="space-y-6">
      {card.group ? (
        <div className="bg-[#008542]/5 border border-[#008542]/20 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[#008542] mb-1">
                <Layers size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Grupo de Alertas</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 truncate">{card.group.name}</h3>
              {card.group.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{card.group.description}</p>}
            </div>
            <button 
              onClick={() => removeFromGroupMutation.mutate()}
              className="text-[10px] font-bold text-[#008542] hover:underline uppercase shrink-0 transition-all hover:scale-105"
            >
              Desvincular Card
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            {onDeleteGroup && (
              <button 
                onClick={() => onDeleteGroup(card.group.id, card.group.name)}
                className="flex-1 py-1.5 text-slate-400 hover:text-red-500 rounded-lg text-[9px] font-bold uppercase tracking-[0.1em] hover:bg-red-50 transition-all flex items-center justify-center gap-2 border border-transparent hover:border-red-100"
              >
                <Trash2 size={11} />
                Excluir Agrupamento
              </button>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Alertas relacionados neste grupo</h4>
            <div className="grid grid-cols-1 gap-3">
              {groupCards.map((c: any, idx: number) => (
                <div 
                  key={`${c.id}-${idx}`}
                  className={cn(
                    "flex items-center justify-between p-4 bg-white border rounded-xl transition-all",
                    c.id === card.id ? "border-[#008542] shadow-sm ring-1 ring-[#008542]/20" : "border-slate-100 opacity-70 hover:opacity-100"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{c.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium">#{c.alertops_alert?.alertops_thread_id || c.id.slice(-6)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.id === card.id ? (
                      <span className="text-[8px] font-black bg-[#008542] text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Atual</span>
                    ) : (
                      <button 
                        onClick={() => onCardClick(c)}
                        className="p-2 hover:bg-slate-50 rounded-full text-[#008542] transition-all hover:scale-110"
                        title="Ver detalhes deste card"
                      >
                        <ExternalLink size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {groupCards.length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhum outro alerta vinculado.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Layers size={32} className="text-[#008542]" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Agrupamento de Alertas</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
              Associe este alerta a outros incidentes relacionados para tratamento unificado.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolher Grupo Existente</h4>
              <span className="text-[10px] font-bold text-slate-300">{groups.length} disponíveis</span>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {groups.map((g, idx) => (
                <button 
                  key={`${g.id}-${idx}`}
                  onClick={() => addToGroupMutation.mutate(g.id)}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#008542] hover:bg-[#008542]/5 transition-all text-left group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700 group-hover:text-[#008542] truncate">{g.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{g.cards?.length || 0} alertas vinculados</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-200 group-hover:text-[#008542] group-hover:translate-x-1 transition-all" />
                </button>
              ))}
              {groups.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400 italic">Nenhum grupo ativo no momento.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            {!isCreating ? (
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full py-4 bg-white border-2 border-dashed border-[#008542] text-[#008542] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#008542]/5 transition-all flex items-center justify-center gap-2"
              >
                <Layers size={16} />
                Novo Agrupamento
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-slate-200 shadow-xl rounded-3xl p-6 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-[#008542] uppercase tracking-widest">Novo Grupo de Incidente</h4>
                  <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Ex: Falha de Rede - Regional Nordeste" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#008542] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição (Opcional)</label>
                    <textarea 
                      placeholder="Descreva o que une estes alertas..." 
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#008542] outline-none h-24 resize-none transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => createGroupMutation.mutate({ name: newGroupName, description: newGroupDesc, cardIds: [card.id] })}
                    disabled={!newGroupName.trim() || createGroupMutation.isPending}
                    className="w-full py-4 bg-[#008542] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#008542]/20 hover:shadow-xl hover:bg-[#007038] transition-all disabled:opacity-50"
                  >
                    {createGroupMutation.isPending ? 'Criando...' : 'Confirmar Agrupamento'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CardDetailDrawer({ card, onClose, groups, allCards, onDeleteGroup, onCardClick }: { card: Card, onClose: () => void, groups: any[], allCards: any[], onDeleteGroup?: (id: string, name: string) => void, onCardClick: (card: Card) => void }) {
  const queryClient = useQueryClient();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const isAdmin = currentUser.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history' | 'reminders' | 'groups'>('details');
  const [prefilledReminderTitle, setPrefilledReminderTitle] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'INTERNAL' | 'EXTERNAL'>('ALL');
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Queries
  const { data: comments = [], isLoading: loadingComments } = useQuery({
     queryKey: ['comments', card.id],
     queryFn: () => kanbanService.getComments(card.id),
     enabled: activeTab === 'comments'
  });

  const { data: users = [] } = useQuery({
     queryKey: ['users', 'active'],
     queryFn: () => kanbanService.getUsers(true)
  });

  const { data: checklist = [], isLoading: loadingChecklist } = useQuery({
     queryKey: ['checklist', card.id],
     queryFn: () => kanbanService.getChecklist(card.id)
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
   queryKey: ['history', card.id],
   queryFn: () => kanbanService.getHistory(card.id),
   enabled: activeTab === 'history'
  });

  const stripHtml = (html: string) => {
    if (!html) return "";
    if (!html.includes('<')) return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item: any) => {
      const matchesType = historyTypeFilter === 'ALL' || item.type === historyTypeFilter;
      
      if (!historySearch) return matchesType;
      
      const searchLower = historySearch.toLowerCase();
      const textToSearch = [
        item.action,
        item.user,
        item.old_value,
        item.new_value,
        item.note,
        item.status,
        item.owner,
        item.resolution
      ].filter(Boolean).join(' ').toLowerCase();

      return matchesType && textToSearch.includes(searchLower);
    });
  }, [history, historySearch, historyTypeFilter]);

  // Mutations
  const commentMutation = useMutation({
     mutationFn: (data: { comment: string, attachments?: any[] }) => 
        editingCommentId 
           ? kanbanService.updateComment(editingCommentId, data.comment, data.attachments)
           : kanbanService.addComment(card.id, data.comment, data.attachments),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['comments', card.id] });
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
        setNewComment('');
        setAttachments([]);
        setEditingCommentId(null);
        toast.success(editingCommentId ? 'Comentário atualizado' : 'Comentário adicionado');
     }
  });

  const deleteCommentMutation = useMutation({
     mutationFn: (id: string) => kanbanService.deleteComment(id),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['comments', card.id] });
        toast.success('Comentário excluído');
     }
  });

  const addChecklistMutation = useMutation({
     mutationFn: (title: string) => kanbanService.addChecklistItem(card.id, title),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['checklist', card.id] });
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
        setNewChecklistItem('');
     }
  });

  const toggleChecklistMutation = useMutation({
     mutationFn: ({ id, is_done, title }: { id: string, is_done?: boolean, title?: string }) => kanbanService.updateChecklistItem(id, { is_done, title }),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['checklist', card.id] });
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
     }
  });

  const deleteChecklistMutation = useMutation({
     mutationFn: (id: string) => kanbanService.deleteChecklistItem(id),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['checklist', card.id] });
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
     }
  });

  const addLabelMutation = useMutation({
     mutationFn: ({ name, color }: { name: string, color: string }) => kanbanService.addLabel(card.id, name, color),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
        toast.success('Etiqueta adicionada');
     }
  });

  const removeLabelMutation = useMutation({
     mutationFn: (id: string) => kanbanService.deleteLabel(id),
     onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
     }
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string | null) => kanbanService.assignCard(card.id, userId),
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['cards'] });
       toast.success('Responsável atualizado');
    }
  });

  const handleAddComment = (e: React.FormEvent) => {
      e.preventDefault();
      // Remove partial HTML tags if it's just <p><br></p>
      const cleanComment = newComment.replace(/<p><br><\/p>/g, '').trim();
      if (!cleanComment && attachments.length === 0) return;
      
      // Enviar os anexos (simulado aqui)
      const mockAttachments = attachments.map(f => ({
         name: f.name,
         size: f.size,
         type: f.type,
         url: URL.createObjectURL(f)
      }));

      commentMutation.mutate({ comment: newComment, attachments: mockAttachments });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files) {
        setAttachments([...attachments, ...Array.from(e.target.files)]);
     }
  };

  const removeAttachment = (index: number) => {
     setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleEditComment = (comment: any) => {
     setNewComment(comment.comment);
     setEditingCommentId(comment.id);
     setActiveTab('comments');
  };

  const highlightMentions = (text: string) => {
    let html = text;
    // Highlight @todos
    html = html.replace(/@todos/gi, '<span class="px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">@todos</span>');
    
    // Highlight specific users
    users.forEach((user: any) => {
      if (user.name) {
        const mention = `@${user.name}`;
        // Escape special characters in name and use boundary check
        const escapedName = user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`@${escapedName}\\b`, 'gi');
        html = html.replace(regex, '<span class="px-1 py-0.5 rounded bg-[#008542]/10 text-[#008542] font-bold">$&</span>');
      }
    });
    return html;
  };

  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
    mention: {
      allowedChars: /^[A-Za-z\sÅÄÖåäö]*$/,
      mentionDenotationChars: ["@"],
      source: async (searchTerm: string, renderList: any, mentionChar: string) => {
        let values = [
          { id: 'todos', value: 'todos', name: 'Todos', email: 'todos@transpetro.com.br' },
          ...users.map((u: any) => ({ 
            id: u.id, 
            value: u.name || u.email,
            email: u.email,
            name: u.name
          }))
        ];

        if (searchTerm.length === 0) {
          renderList(values, searchTerm);
        } else {
          const matches = values.filter(item => 
            item.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase()))
          );
          renderList(matches, searchTerm);
        }
      },
      renderItem: (item: any) => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 px-3 py-1.5";
        
        const char = (item.value || '').charAt(0).toUpperCase() || '?';
        const displayName = item.name || item.value || 'Usuário';
        
        if (item.id === 'todos') {
          div.innerHTML = `
            <div class="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">@</div>
            <div class="flex flex-col text-left leading-tight">
              <span class="text-[11px] font-bold text-[#008542]">Todos</span>
              <span class="text-[9px] text-slate-400">Notificar todos</span>
            </div>
          `;
        } else {
          div.innerHTML = `
            <div class="w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0">${char}</div>
            <div class="flex flex-col text-left leading-tight">
              <span class="text-[11px] font-bold text-slate-700">${displayName}</span>
              <span class="text-[9px] text-slate-400 font-medium">${item.email || ''}</span>
            </div>
          `;
        }
        return div;
      },
      mentionContainerClass: 'ql-mention-list-container shadow-2xl border border-slate-200 rounded-lg bg-white',
      listItemClass: 'ql-mention-list-item hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0',
      offsetTop: 2,
    }
  }), [users]);

  const handleAddChecklist = (e: React.FormEvent) => {
     e.preventDefault();
     if (!newChecklistItem.trim()) return;
     addChecklistMutation.mutate(newChecklistItem);
  };

  const handleStartEdit = (item: any) => {
    if (item.is_done) return;
    setEditingItemId(item.id);
    setEditValue(item.title);
  };

  const handleSaveEdit = (item: any) => {
    if (editValue.trim() && editValue !== item.title) {
      toggleChecklistMutation.mutate({ id: item.id, title: editValue });
    }
    setEditingItemId(null);
  };

  const labelColors = [
     { name: 'Crítico', color: '#ef4444' },
     { name: 'Atenção', color: '#f59e0b' },
     { name: 'Operação', color: '#10b981' },
     { name: 'Logística', color: '#3b82f6' },
     { name: 'Segurança', color: '#6366f1' },
     { name: 'Meio Ambiente', color: '#8b5cf6' },
  ];

  const colors = getCriticalityColors(card.criticidade);
  
  const handleCopyLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const shortId = card.alertops_alert?.alertops_thread_id || card.id;
    const shortUrl = `${baseUrl}?cardId=${shortId}`;
    navigator.clipboard.writeText(shortUrl);
    toast.success('Link do card copiado!');
  };

  const getFileIcon = (type: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (type?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={12} className="text-blue-500" />;
    if (type?.includes('pdf') || ext === 'pdf') return <FileText size={12} className="text-red-500" />;
    if (type?.includes('zip') || type?.includes('rar') || ['zip', 'rar', '7z', 'tar'].includes(ext || '')) return <FileArchive size={12} className="text-amber-500" />;
    if (type?.includes('audio') || ['mp3', 'wav', 'ogg'].includes(ext || '')) return <Music size={12} className="text-purple-500" />;
    if (type?.includes('video') || ['mp4', 'mov', 'avi'].includes(ext || '')) return <Video size={12} className="text-blue-500" />;
    if (type?.includes('excel') || type?.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet size={12} className="text-emerald-500" />;
    return <FileQuestion size={12} className="text-slate-400" />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex justify-end"
    >
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header Drawer */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <AlertCircle className={cn(colors.text)} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">{card.alertops_alert?.source_identifier || card.title}</h2>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] text-[#008542] font-bold uppercase tracking-wider">Gerenciamento de Alerta</span>
                   <span className="w-1 h-1 rounded-full bg-slate-300" />
                   <span className="text-[10px] text-slate-400 font-mono italic">Thread: {card.alertops_alert?.alertops_thread_id}</span>
                   <span className="w-1 h-1 rounded-full bg-slate-300" />
                   <span className={cn("text-[10px] font-bold uppercase tracking-widest", colors.text)}>{card.criticidade || 'Normal'}</span>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setPrefilledReminderTitle(`Verificar Alerta #${card.alertops_alert?.alertops_thread_id || card.id.slice(-6)}: "${card.alertops_alert?.source_identifier || card.title}"`);
                setActiveTab('reminders');
              }}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#008542] transition-colors"
              title="Agendar lembrete para este alerta"
            >
              <Bell size={18} />
            </button>
            <button 
              onClick={handleCopyLink}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#008542] transition-colors"
              title="Copiar link do card"
            >
              <Link size={18} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="px-8 flex items-center gap-6 border-b border-slate-100 bg-white shrink-0">
           <button 
             onClick={() => setActiveTab('details')}
             className={cn(
               "py-4 text-xs font-bold uppercase tracking-widest transition-all relative",
               activeTab === 'details' ? "text-[#008542]" : "text-slate-400 hover:text-slate-600"
             )}
           >
              Detalhes Clínicos
              {activeTab === 'details' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008542]" />}
           </button>
           <button 
             onClick={() => setActiveTab('comments')}
             className={cn(
               "py-4 text-xs font-bold uppercase tracking-widest transition-all relative flex items-center gap-2",
               activeTab === 'comments' ? "text-[#008542]" : "text-slate-400 hover:text-slate-600"
             )}
           >
              Comentários
              {activeTab === 'comments' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008542]" />}
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={cn(
               "py-4 text-xs font-bold uppercase tracking-widest transition-all relative",
               activeTab === 'history' ? "text-[#008542]" : "text-slate-400 hover:text-slate-600"
             )}
           >
              Histórico
              {activeTab === 'history' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008542]" />}
           </button>
           <button 
             onClick={() => setActiveTab('reminders')}
             className={cn(
               "py-4 text-xs font-bold uppercase tracking-widest transition-all relative flex items-center gap-2",
               activeTab === 'reminders' ? "text-[#008542]" : "text-slate-400 hover:text-slate-600"
             )}
           >
              Lembretes
              {activeTab === 'reminders' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008542]" />}
           </button>
           <button 
             onClick={() => setActiveTab('groups')}
             className={cn(
               "py-4 text-xs font-bold uppercase tracking-widest transition-all relative flex items-center gap-2",
               activeTab === 'groups' ? "text-[#008542]" : "text-slate-400 hover:text-slate-600"
             )}
           >
              Agrupamentos
              {card.group && <div className="w-1.5 h-1.5 rounded-full bg-[#008542] animate-pulse" />}
              {activeTab === 'groups' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008542]" />}
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 scrollbar-hide bg-[#f8fafc]">
          {activeTab === 'details' && (
            <div className="space-y-8">
              <section>
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Mensagem do Alerta</h4>
                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
                       <MessageSquare size={14} className="text-[#008542]" />
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-bold break-words">
                       {card.message_text || card.alertops_alert?.message_text || 'Sem mensagem registrada'}
                    </p>
                 </div>
              </section>

{/* 
              <section>
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Etiquetas</h4>
                 <div className="flex flex-wrap gap-2 mb-4">
                    {card.labels?.map((label, idx) => (
                       <div 
                         key={`${label.id || 'label-det'}-${idx}`} 
                         onClick={() => removeLabelMutation.mutate(label.id)}
                         className="flex items-center gap-2 px-2 py-1 rounded text-[10px] font-bold text-white cursor-pointer hover:opacity-80 transition-all select-none"
                         style={{ backgroundColor: label.color }}
                       >
                          {label.name}
                          <X size={10} />
                       </div>
                    ))}
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {labelColors.map((lc, idx) => (
                       <button 
                         key={`${lc.name}-${idx}`}
                         onClick={() => addLabelMutation.mutate(lc)}
                         disabled={card.labels?.some(l => l.name === lc.name)}
                         className="w-6 h-6 rounded-full border border-slate-200 hover:scale-110 transition-transform disabled:opacity-20 flex items-center justify-center"
                         style={{ backgroundColor: lc.color }}
                         title={lc.name}
                       />
                    ))}
                 </div>
              </section>
              */}

              <section>
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Informações de Identidade</h4>
                 <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3">
                       <LayoutGrid size={14} className="text-slate-100" />
                    </div>
                    <InfoItem label="Identificador" value={card.alertops_alert?.source_identifier || '-'} />
                    <InfoItem label="Integração" value={card.alertops_alert?.integration_name || '-'} />
                    <InfoItem label="Thread ID" value={card.alertops_alert?.alertops_thread_id || '-'} />
                    <InfoItem label="Criticidade" value={card.criticidade || '-'} isBadge />
                    <InfoItem label="Proprietário (AlertOps)" value={card.owner_name || 'Alerta Livre'} />
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável (Interno)</label>
                       <select 
                         value={card.assigned_user_id || ''} 
                         onChange={(e) => assignMutation.mutate(e.target.value || null)}
                         className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#008542] outline-none font-bold text-[#008542] appearance-none cursor-pointer"
                       >
                          <option value="">Não atribuído</option>
                          {users.map((u: any, idx) => (
                             <option key={`${u.id}-${idx}`} value={u.id}>{u.name || u.email}</option>
                          ))}
                       </select>
                    </div>
                    <InfoItem label="SLA Deadline" value={card.due_at ? format(new Date(card.due_at), 'dd/MM/yyyy HH:mm:ss') : '-'} />
                 </div>
              </section>

              <section>
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Checklist</h4>
                    <span className="text-[10px] font-bold text-[#008542]">
                       {checklist.filter((i: any) => i.is_done).length}/{checklist.length} concluídos
                    </span>
                 </div>
                 
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-100">
                       {checklist.map((item: any, idx: number) => (
                          <div key={`${item.id}-${idx}`} className="p-4 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                             <div className="flex items-center gap-3 flex-1">
                                <button 
                                  onClick={() => toggleChecklistMutation.mutate({ id: item.id, is_done: !item.is_done })}
                                  className={cn(
                                    "w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0",
                                    item.is_done ? "bg-[#008542] border-[#008542] text-white" : "border-slate-300 bg-white"
                                  )}
                                >
                                   {item.is_done && <CheckSquare size={12} />}
                                </button>
                                
                                {editingItemId === item.id ? (
                                  <input 
                                    autoFocus
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => handleSaveEdit(item)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(item);
                                      if (e.key === 'Escape') setEditingItemId(null);
                                    }}
                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#008542]"
                                  />
                                ) : (
                                  <span 
                                    onClick={() => handleStartEdit(item)}
                                    className={cn(
                                      "text-sm transition-all flex-1 py-0.5",
                                      item.is_done ? "text-slate-400 line-through" : "text-slate-700 font-medium cursor-text"
                                    )}
                                  >
                                     {item.title}
                                  </span>
                                )}
                             </div>
                             <button 
                               onClick={() => deleteChecklistMutation.mutate(item.id)}
                               className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                             >
                                <X size={14} />
                             </button>
                          </div>
                       ))}
                    </div>
                    <form onSubmit={handleAddChecklist} className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                       <input 
                         type="text" 
                         value={newChecklistItem}
                         onChange={(e) => setNewChecklistItem(e.target.value)}
                         placeholder="Adicionar um item..."
                         className="flex-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#008542]"
                       />
                       <button 
                         type="submit"
                         disabled={!newChecklistItem.trim()}
                         className="text-[10px] font-black text-[#008542] uppercase tracking-widest disabled:opacity-30"
                       >
                          Adicionar
                       </button>
                    </form>
                 </div>
              </section>

              <section>
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Descrição & Tópico</h4>
                 <div className="space-y-4">
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                       <p className="text-[10px] font-bold text-[#008542] mb-2 uppercase italic tracking-wider">Tópico Raw:</p>
                       {card.alertops_alert?.topic?.startsWith('https://') ? (
                          <a 
                            href={card.alertops_alert.topic} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-bold break-all"
                          >
                             {getFriendlyLinkLabel(card.alertops_alert.topic)} <ExternalLink size={14} className="inline shrink-0" />
                          </a>
                       ) : (
                          <p className="text-sm text-slate-800 leading-relaxed font-semibold italic">{card.alertops_alert?.topic || 'Sem tópico'}</p>
                       )}
                    </div>
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                       <p className="text-[10px] font-bold text-[#008542] mb-2 uppercase tracking-wider">Descrição Detalhada:</p>
                       {card.description?.startsWith('https://') ? (
                          <a 
                            href={card.description} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-medium break-all"
                          >
                             {getFriendlyLinkLabel(card.description)} <ExternalLink size={14} className="inline shrink-0" />
                          </a>
                       ) : (
                          <p className="text-sm text-slate-600 leading-relaxed break-words">{card.description || 'Sem descrição adicional'}</p>
                       )}
                    </div>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="flex flex-col h-full space-y-6">
               {/* Comment Form */}
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative">
                  {editingCommentId && (
                     <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-700 uppercase leading-none">Editando comentário</span>
                        <button onClick={() => { setEditingCommentId(null); setNewComment(''); }} className="text-amber-700 hover:text-amber-900 transition-colors">
                           <X size={14} />
                        </button>
                     </div>
                  )}
                  <div className="p-1">
                     <ReactQuill 
                        theme="snow"
                        value={newComment}
                        onChange={setNewComment}
                        modules={quillModules}
                        placeholder="Adicione uma nota operacional..."
                        className="border-none quill-editor"
                     />
                  </div>
                  
                  {attachments.length > 0 && (
                     <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap gap-2 bg-slate-50">
                        {attachments.map((file, i) => (
                           <div key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 text-[10px] font-medium text-slate-600">
                              {getFileIcon(file.type, file.name)}
                                                             <a 
                                 href={URL.createObjectURL(file)} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className="max-w-[120px] truncate hover:text-[#008542] transition-colors cursor-pointer"
                                 title="Clique para visualizar"
                               >
                                 {file.name}
                               </a>
                              <button onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                                 <X size={10} />
                              </button>
                           </div>
                        ))}
                     </div>
                  )}

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <label className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition-colors" title="Anexar arquivo">
                           <Paperclip size={18} />
                           <input type="file" multiple className="hidden" onChange={handleFileChange} />
                        </label>
                        <div className="h-4 w-px bg-slate-200 mx-1" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight hidden sm:block">
                           Use <code className="bg-slate-200 px-1 rounded text-[#008542]">@nome</code> para mencionar
                        </span>
                     </div>
                     <button 
                       onClick={handleAddComment}
                       disabled={commentMutation.isPending || (!newComment.replace(/<p><br><\/p>/g, '').trim() && attachments.length === 0)}
                       className="flex items-center gap-2 px-6 py-2 bg-[#008542] text-[#ffcc00] rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 hover:bg-green-800 transition-all shadow-md active:scale-95"
                     >
                        {commentMutation.isPending ? 'Enviando...' : editingCommentId ? 'Salvar Edição' : 'Postar Comentário'}
                        <Send size={14} />
                     </button>
                  </div>
               </div>

               {/* Comments List */}
               <div className="space-y-4 pb-12">
                  {loadingComments ? (
                    <div className="text-center py-8 text-slate-400 text-sm italic">Sincronizando notas operacionais...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                       <MessageSquare size={32} className="mx-auto text-slate-200 mb-3" />
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Nenhuma nota registrada</p>
                       <p className="text-slate-300 text-[10px] mt-1 italic">Este thread de alerta ainda não possui comentários.</p>
                    </div>
                  ) : (
                    comments.map((comment: any, idx: number) => {
                       const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;
                       return (
                        <div key={`${comment.id}-${idx}`} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#008542]/30 transition-all">
                           <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                 <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-[#008542]">
                                    {comment.user?.name?.charAt(0) || 'U'}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                       {comment.user?.name || 'Administrador'}
                                       {isEdited && <span className="text-[8px] font-normal text-slate-400 normal-case">(editado)</span>}
                                    </span>
                                    <p className="text-[9px] text-slate-400 font-medium">
                                       {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                                    </p>
                                 </div>
                              </div>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 {/** EDIT: Only Owner */}
                                 {comment.user_id === currentUser.id && (
                                   <button 
                                      onClick={() => handleEditComment(comment)}
                                      className="p-1.5 hover:bg-slate-50 rounded-md text-slate-400 hover:text-[#008542] transition-colors"
                                      title="Editar seu comentário"
                                   >
                                      <Edit2 size={12} />
                                   </button>
                                 )}

                                 {/** DELETE: Owner or Admin */}
                                 {(comment.user_id === currentUser.id || isAdmin) && (
                                   <button 
                                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                                      className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                                      title={isAdmin && comment.user_id !== currentUser.id ? "Excluir como Administrador" : "Excluir seu comentário"}
                                   >
                                      <Trash2 size={12} />
                                   </button>
                                 )}
                                 <button 
                                    onClick={() => {
                                       setPrefilledReminderTitle(`Verificar nota de ${comment.user?.name}: "${stripHtml(comment.comment).slice(0, 30)}..." - Alerta #${card.alertops_alert?.alertops_thread_id || card.id.slice(-6)}`);
                                       setActiveTab('reminders');
                                    }}
                                    className="p-1.5 hover:bg-slate-50 rounded-md text-slate-400 hover:text-[#008542] transition-colors"
                                    title="Criar lembrete desta nota"
                                 >
                                    <Bell size={12} />
                                  </button>
                              </div>
                           </div>

                           <div 
                             className="text-sm text-slate-600 leading-relaxed mb-4 prose-sm prose-slate max-w-none break-words" 
                             dangerouslySetInnerHTML={{ __html: highlightMentions(comment.comment) }} 
                           />
                           
                           {comment.attachments && comment.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50">
                                 {comment.attachments.map((att: any, idx: number) => (
                                    <a 
                                       key={`${att.id || att.name}-${idx}`}
                                       href={att.url}
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-500 hover:bg-[#008542]/5 hover:text-[#008542] transition-all"
                                       title="Clique para abrir em uma nova aba"
                                    >
                                       {getFileIcon(att.type, att.name)}
                                       <span className="max-w-[150px] truncate">{att.name}</span>
                                    </a>
                                 ))}
                              </div>
                           )}
                        </div>
                       );
                    })
                  )}
               </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6 pb-12">
               <div className="flex flex-col gap-4 mb-8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Pesquisar no histórico..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm italic focus:ring-2 focus:ring-[#008542] transition-all"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                      { id: 'ALL', label: 'Tudo', icon: History },
                      { id: 'INTERNAL', label: 'SaaS (Operacional)', icon: LayoutGrid },
                      { id: 'EXTERNAL', label: 'AlertOps (Evolução)', icon: AlertCircle }
                    ].map((btn, idx) => (
                      <button
                        key={`${btn.id}-${idx}`}
                        onClick={() => setHistoryTypeFilter(btn.id as any)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                          historyTypeFilter === btn.id 
                            ? "bg-[#008542] text-[#ffcc00] border-[#008542] shadow-md"
                            : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <btn.icon size={12} />
                        {btn.label}
                      </button>
                    ))}
                  </div>
               </div>

               {loadingHistory ? (
                 <div className="text-center py-20 text-slate-400 text-sm italic">Recuperando histórico completo...</div>
               ) : filteredHistory.length === 0 ? (
                 <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-3xl">
                    <History size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                       {historySearch || historyTypeFilter !== 'ALL' ? 'Nenhum resultado para os filtros aplicados' : 'Nenhuma movimentação registrada'}
                    </p>
                    {(historySearch || historyTypeFilter !== 'ALL') && (
                       <button 
                        onClick={() => { setHistorySearch(''); setHistoryTypeFilter('ALL'); }}
                        className="mt-4 text-[#008542] text-[10px] font-black uppercase hover:underline"
                       >
                         Limpar Filtros
                       </button>
                    )}
                 </div>
               ) : (
                 <div className="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-8">
                    {filteredHistory.map((item: any, idx: number) => (
                       <div key={`${item.id}-${idx}`} className="relative">
                          {/* Dot */}
                          <div className={cn(
                             "absolute -left-[41px] w-4 h-4 rounded-full border-4 border-white shadow-sm z-10",
                             item.type === 'EXTERNAL' ? "bg-amber-500" : "bg-[#008542]"
                          )} />
                          
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                             <div className="flex items-center justify-between mb-3">
                                <span className={cn(
                                   "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter",
                                   item.type === 'EXTERNAL' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                )}>
                                   {item.type === 'EXTERNAL' ? 'AlertOps (Evolução)' : 'SaaS (Operacional)'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                   {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                             </div>

                             <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-2">
                                {item.action === 'STATUS_CHANGE' ? 'Alteração de Status' : 
                                 item.action === 'ASSIGN_CHANGE' ? 'Mudar Responsável' :
                                 item.action === 'CRITICALITY_UPDATED' ? 'Evolução de Criticidade' :
                                 item.action === 'OWNER_UPDATED' ? 'Mudança de Proprietário (AlertOps)' :
                                 item.action === 'CREATED_FROM_SYNC' ? 'Sincronização Inicial' :
                                 item.action === 'ALERTOPS_SYNC' ? `Atualização: ${item.status || 'Nota'}` :
                                 item.action}
                             </h4>

                             {item.user && (
                                <p className="text-[10px] text-slate-500 mb-2 italic">
                                   Por: <span className="font-bold text-slate-700">{item.user}</span>
                                </p>
                             )}

                             {item.type === 'INTERNAL' && (item.old_value || item.new_value) && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center gap-3">
                                   {item.old_value && (
                                      <>
                                         <span className="text-slate-400 strike-through line-through opacity-60">
                                            {item.action === 'COMMENT_ADDED' || item.action === 'COMMENT_UPDATED' ? stripHtml(item.old_value) : item.old_value}
                                         </span>
                                         <ArrowRight size={12} className="text-slate-300" />
                                      </>
                                   )}
                                   <span className="font-bold text-[#008542]">
                                      {item.action === 'COMMENT_ADDED' || item.action === 'COMMENT_UPDATED' ? stripHtml(item.new_value) : item.new_value}
                                   </span>
                                </div>
                             )}

                             {item.type === 'EXTERNAL' && (
                                <div className="space-y-3">
                                   {item.note && (
                                      <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                                         <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">Nota do Alerta:</p>
                                         <p className="text-sm text-slate-600 italic">"{item.note}"</p>
                                      </div>
                                   )}
                                   {item.owner && (
                                      <p className="text-[10px] text-slate-500">
                                         Dono no AlertOps: <span className="font-bold">{item.owner}</span>
                                      </p>
                                   )}
                                   {item.resolution && (
                                     <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <p className="text-[10px] font-bold text-emerald-800 uppercase mb-1">Resolução:</p>
                                        <p className="text-sm text-slate-600">{item.resolution}</p>
                                     </div>
                                   )}
                                </div>
                             )}
                          </div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'reminders' && (
            <RemindersTab 
              cardId={card.id} 
              users={users} 
              prefilledTitle={prefilledReminderTitle}
              onClearPrefill={() => setPrefilledReminderTitle('')}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsTab 
              card={card} 
              groups={groups} 
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['cards'] })} 
              allCards={allCards}
              onDeleteGroup={onDeleteGroup}
              onCardClick={onCardClick}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoItem({ label, value, isBadge }: { label: string, value: string, isBadge?: boolean }) {
  const isCriticality = label.toLowerCase() === 'criticidade';
  const colors = isCriticality ? getCriticalityColors(value) : null;

  return (
    <div>
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight mb-1">{label}</p>
      {isBadge ? (
        <span className={cn(
          "inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase",
          isCriticality && colors ? colors.badge : "bg-[#008542]/10 text-[#008542]"
        )}>
          {value}
        </span>
      ) : (
        <p className="text-sm font-semibold text-neutral-700 truncate">{value}</p>
      )}
    </div>
  );
}

function ActionTab({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full text-xs font-bold transition-colors">
       {icon} {label}
    </button>
  );
}

/**
 * Componente de Tooltip Customizado para Gráficos (Estilo Premium)
 */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 animate-in fade-in zoom-in duration-300 backdrop-blur-md bg-opacity-95">
        <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-emerald-400 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          {label || payload[0].name}
        </p>
        <div className="flex items-center justify-between gap-8">
          <span className="text-slate-400 text-[10px] font-bold uppercase">Volume:</span>
          <span className="text-sm font-black">{payload[0].value} <span className="text-[10px] text-slate-500 font-normal">Alertas</span></span>
        </div>
      </div>
    );
  }
  return null;
};

function ChartsView({ cards, statuses }: { cards: any[], statuses: any[] }) {
  const criticalityData = useMemo(() => {
    const counts: Record<string, number> = {};
    cards.forEach(c => {
      const rawCrit = c.criticidade || 'INDEFINIDA';
      const crit = rawCrit.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      counts[crit] = (counts[crit] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [cards]);

  const statusData = useMemo(() => {
    return statuses.map(s => ({
      name: s.name,
      value: cards.filter(c => c.status_id === s.id).length
    }));
  }, [cards, statuses]);

  const getCritColor = (name: string) => {
    const norm = name.toUpperCase();
    if (norm.includes('CRITICA')) return '#9333ea'; // Purple (matching getCriticalityColors)
    if (norm.includes('ALTA')) return '#ef4444'; // Red
    if (norm.includes('MEDIA')) return '#facc15'; // Yellow
    if (norm.includes('BAIXA')) return '#22c55e'; // Green
    return '#94a3b8'; // Slate
  };

  const COLORS = ['#008542', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4 flex items-center justify-between">
          <span>Distribuição por Criticidade</span>
          <span className="text-[10px] text-[#008542]">{cards.length} Total</span>
        </h3>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={criticalityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                fontSize={10} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontWeight: 'bold' }} 
              />
              <YAxis 
                fontSize={10} 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#64748b' }}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: '#f8fafc', radius: 4 }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                {criticalityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCritColor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">
          Status dos Alertas
        </h3>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="40%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                align="center"
                iconType="circle" 
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function AgendaView({ cards, onCardClick }: { cards: any[], onCardClick: (card: any) => void }) {
  const sortedCards = useMemo(() => {
    return [...cards]
      .filter(c => c.due_at)
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  }, [cards]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-[#008542] rounded-lg">
               <Calendar size={18} className="text-[#ffcc00]" />
            </div>
            <div>
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Cronograma de Vencimento (SLA)</h3>
               <p className="text-[9px] text-slate-400 font-bold uppercase">Monitoramento temporal dos alertas assigned</p>
            </div>
         </div>
         <span className="text-[10px] font-black text-[#008542] bg-[#008542]/10 px-3 py-1 rounded-full uppercase">{sortedCards.length} Alertas com Prazo</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-green">
        {sortedCards.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-dashed border-slate-200">
                <Calendar size={32} className="text-slate-200" />
             </div>
             <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum prazo definido</p>
                <p className="text-xs text-slate-300 italic">Os alertas atuais não possuem data de SLA configurada.</p>
             </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedCards.map((card, idx) => {
              const diff = card.due_at ? new Date(card.due_at).getTime() - new Date().getTime() : 0;
              const isOverdue = diff < 0;
              const isClose = diff > 0 && diff < 1000 * 60 * 60 * 2; // 2 hours
              
              const colors = getCriticalityColors(card.criticidade);

              return (
                <div 
                  key={`${card.id}-${idx}`} 
                  onClick={() => onCardClick(card)}
                  className="p-5 hover:bg-slate-50 transition-all cursor-pointer group flex items-center gap-6"
                >
                  <div className={cn("w-1 h-12 rounded-full shrink-0", colors.border.replace('border-l-', 'bg-'))} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">#{card.alertops_alert?.alertops_thread_id?.slice(-8) || card.id.slice(-6)}</span>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter shadow-sm", colors.badge)}>
                        {card.criticidade || 'NORMAL'}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 truncate group-hover:text-[#008542] transition-colors leading-tight">
                      {card.alertops_alert?.source_identifier || card.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 truncate italic">
                       {card.message_text || 'Sem descrição adicional disponível'}
                    </p>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className={cn(
                      "text-xs font-black flex items-center gap-2 justify-end mb-1",
                      isOverdue ? "text-red-500" : isClose ? "text-amber-500" : "text-[#008542]"
                    )}>
                      <Clock size={14} className={cn(isOverdue && "animate-pulse")} />
                      {card.due_at ? format(new Date(card.due_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Sem prazo'}
                    </div>
                    {card.due_at && (
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-2 py-0.5 rounded-md",
                        isOverdue ? "bg-red-50 text-red-600" : isClose ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {formatDistanceToNow(new Date(card.due_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                  
                  <div className="p-2 bg-white rounded-lg border border-slate-100 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                     <ArrowRight size={14} className="text-[#008542]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
