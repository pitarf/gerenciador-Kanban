import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { AlertCircle, CheckCircle2, Clock, Inbox, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useState } from 'react';

const getCritColor = (name: string) => {
  const norm = name.toUpperCase();
  if (norm.includes('CRITICA')) return '#9333ea'; // Purple
  if (norm.includes('ALTA')) return '#ef4444'; // Red
  if (norm.includes('MEDIA')) return '#facc15'; // Yellow
  if (norm.includes('BAIXA')) return '#22c55e'; // Green
  return '#94a3b8'; // Slate
};

export default function MetricsPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/metrics', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      return res.json();
    }
  });

  const chartData = metrics?.dailyStats || [];
  const pieData = metrics?.criticalityDistribution || [];

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#008542]/20 border-t-[#008542] rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Carregando Indicadores...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-[1600px] mx-auto p-4 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Visão Geral</h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Indicadores de performance operacional em tempo real</p>
        <div className="h-1 w-20 bg-[#008542] mt-2 rounded-full" />
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard 
          title="Alertas Assigned" 
          value={metrics?.totalAssigned || 0} 
          icon={<Inbox size={20} className="text-[#ffcc00]" />}
          trend="+5% vs ontem"
          color="bg-[#008542]"
          description="Total de alertas provenientes do AlertOps que estão atualmente com status 'Assigned' aguardando triagem."
        />
        <MetricCard 
          title="Cards Abertos" 
          value={metrics?.openCards || 0} 
          icon={<AlertCircle size={20} className="text-white" />}
          trend="-2% vs ontem"
          color="bg-slate-800"
          description="Quantidade total de incidentes ativos no quadro Kanban (excluindo os arquivados)."
        />
        <MetricCard 
          title="MTTR Médio" 
          value={`${metrics?.mttr || 0}min`} 
          icon={<Clock size={20} className="text-[#008542]" />}
          trend="-4 min"
          color="bg-white border-slate-200"
          iconColor="text-[#008542]"
          description="Mean Time To Resolution: Tempo médio decorrido entre a abertura do card e o status final de resolvido."
        />
        <MetricCard 
          title="SLA (95%)" 
          value={`${metrics?.sla || 0}%`} 
          icon={<CheckCircle2 size={20} className="text-[#008542]" />}
          trend="+3%"
          color="bg-white border-slate-200"
          iconColor="text-[#008542]"
          description="Service Level Agreement: Porcentagem de cards que foram resolvidos dentro do prazo estipulado (DueDate)."
        />
        <MetricCard 
          title="Cards Vencidos" 
          value={metrics?.overdue || 0} 
          icon={<Clock size={20} className="text-white" />}
          trend="Estável"
          color="bg-red-500"
          description="Cards que já ultrapassaram a data limite de resolução e ainda não foram finalizados."
        />
        <MetricCard 
          title="Resolvidos (24h)" 
          value={metrics?.resolvedLast24h || 0} 
          icon={<CheckCircle2 size={20} className="text-white" />}
          trend="+12% vs ontem"
          color="bg-[#008542]"
          description="Total de cards que foram movidos para a coluna final de resolução nas últimas 24 horas."
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
        <ChartContainer title="Volume de Alertas por Dia">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#64748b' }} 
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }} 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }} 
              />
              <Bar dataKey="total" fill="#008542" radius={[6, 6, 0, 0]} barSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Distribuição por Criticidade">
          <div className="relative h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${entry.name}-${index}`} fill={getCritColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Legend Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900">{metrics?.openCards || 0}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
            </div>
            
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {pieData.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCritColor(entry.name) }} />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </div>
        </ChartContainer>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, color, description, iconColor }: any) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative group/card">
      <AnimatePresence>
        {showTooltip && description && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 right-0 mb-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 z-[100] pointer-events-none backdrop-blur-md bg-opacity-95"
          >
            <div className="flex flex-col gap-1">
              {description.includes(':') ? (
                <>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    {description.split(':')[0]}
                  </p>
                  <p className="text-[10px] font-medium text-slate-300 leading-relaxed normal-case">
                    {description.split(':')[1].trim()}
                  </p>
                </>
              ) : (
                <p className="text-[10px] font-medium text-white leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <div className="absolute top-full left-6 border-8 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        whileHover={{ y: -6, scale: 1.02 }}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
        transition={{ type: "spring", stiffness: 300 }}
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group cursor-default h-[160px] relative"
      >
        <div className="flex items-center justify-between mb-3">
          <div className={cn("p-2 rounded-xl border shadow-sm transition-colors", color || "bg-white", !color && "border-slate-100")}>
            {icon}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{trend}</span>
            <div className="h-0.5 w-8 bg-slate-100 mt-1 rounded-full overflow-hidden">
               <div className="h-full bg-[#008542] w-1/2" />
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-widest group-hover:text-slate-600 transition-colors line-clamp-1">{title}</h3>
            <HelpCircle size={10} className="text-slate-300 transition-colors group-hover/card:text-[#008542]" />
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
        </div>
      </motion.div>
    </div>
  );
}

function ChartContainer({ title, children }: any) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{title}</h3>
        <div className="flex gap-1">
           <div className="w-1.5 h-1.5 rounded-full bg-[#008542]" />
           <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
           <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
        </div>
      </div>
      {children}
    </div>
  );
}
