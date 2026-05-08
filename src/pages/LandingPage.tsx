import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, BarChart3, LayoutGrid, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans italic">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#008542] rounded-md flex items-center justify-center">
            <span className="text-[#ffcc00] font-bold text-lg italic">T</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 uppercase text-sm">AlertOps Manager</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider">
            Entrar
          </Link>
          <Link to="/register" className="px-5 py-2 text-sm font-bold bg-[#008542] text-[#ffcc00] rounded-md hover:bg-green-800 transition-colors uppercase tracking-wider">
            Começar Agora
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <section className="max-w-7xl mx-auto px-6 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-8 text-slate-900 uppercase">
              AlertOps <span className="text-[#008542]">Manager</span>
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-12 font-medium">
              A plataforma definitiva para controle operacional de incidentes e alertas do AlertOps.
            </p>
            <Link to="/login" className="inline-flex items-center gap-3 px-10 py-5 bg-[#008542] text-[#ffcc00] font-black rounded-md shadow-xl hover:bg-green-900 transition-all transform hover:scale-105 uppercase tracking-widest text-sm">
              Inicie a Operação <ArrowRight size={20} />
            </Link>
          </motion.div>
        </section>

        {/* Features */}
        <section className="bg-white py-32 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<LayoutGrid className="text-[#008542]" size={36} />}
              title="KANBAN OPERACIONAL"
              description="Fluxo de trabalho customizado para centros de controle integrados (CNCO)."
            />
            <FeatureCard 
              icon={<BarChart3 className="text-[#008542]" size={36} />}
              title="KPIS & MÉTRICAS"
              description="Monitoramento de MTTR e conformidade de SLA em tempo real por terminal."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-[#008542]" size={36} />}
              title="SECURITY FIRST"
              description="Autenticação RBAC e logs de auditoria para conformidade normativa."
            />
          </div>
        </section>
      </main>

      <footer className="py-16 border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 TRANSPETRO S.A. - SISTEMA DE GESTÃO DE ALERTAS
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-10 bg-slate-50 border border-slate-100 rounded-lg hover:shadow-2xl transition-all group">
      <div className="mb-8 p-4 bg-white inline-block rounded-md shadow-sm group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-sm font-black mb-4 uppercase tracking-wider text-slate-900 italic">{title}</h3>
      <p className="text-slate-500 leading-relaxed font-medium text-sm">{description}</p>
    </div>
  );
}
