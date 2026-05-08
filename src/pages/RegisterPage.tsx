import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Lock, Mail, User, Building2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    tenantName: '',
    joinCode: ''
  });
  const [isJoining, setIsJoining] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          tenant_name: isJoining ? undefined : formData.tenantName,
          join_code: isJoining ? formData.joinCode : undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar cadastro');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      toast.success('Cadastro realizado com sucesso!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans italic">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="bg-[#008542] p-8 text-center text-white relative">
          <Link to="/login" className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
            <User size={24} />
          </div>
          <h1 className="text-xl font-bold italic">{isJoining ? 'Entrar em uma Organização' : 'Criar uma nova conta'}</h1>
          <p className="text-white/70 text-[10px] mt-1 uppercase tracking-wider">
            {isJoining ? 'digite o código de acesso da unidade' : 'cadastre-se no AlertOps'}
          </p>
        </div>

        <div className="flex border-b border-slate-100">
           <button 
            type="button"
            onClick={() => setIsJoining(false)}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              !isJoining ? "text-[#008542] border-b-2 border-[#008542]" : "text-slate-400 hover:text-slate-600"
            )}
           >
             Criar Unidade
           </button>
           <button 
            type="button"
            onClick={() => setIsJoining(true)}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              isJoining ? "text-[#008542] border-b-2 border-[#008542]" : "text-slate-400 hover:text-slate-600"
            )}
           >
             Entrar com Código
           </button>
        </div>

        <form onSubmit={handleRegister} className="p-8 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008542] focus:border-transparent transition-all placeholder:text-slate-400 text-sm italic"
                placeholder="Seu nome"
              />
            </div>
          </div>

          {!isJoining ? (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Nome da Sua Organização</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  name="tenantName"
                  required
                  value={formData.tenantName}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008542] focus:border-transparent transition-all placeholder:text-slate-400 text-sm italic"
                  placeholder="Nome da sua empresa"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Código da Organização</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  name="joinCode"
                  required
                  value={formData.joinCode}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008542] focus:border-transparent transition-all placeholder:text-slate-400 text-sm italic font-mono"
                  placeholder="Ex: TRP-2026"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008542] focus:border-transparent transition-all placeholder:text-slate-400 text-sm italic"
                placeholder="exemplo@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008542] focus:border-transparent transition-all placeholder:text-slate-400 text-sm italic"
                  placeholder="••••••"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Confirmar</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008542] focus:border-transparent transition-all placeholder:text-slate-400 text-sm italic"
                  placeholder="••••••"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1">
             <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#008542] text-[#ffcc00] font-black rounded-xl shadow-lg hover:bg-green-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-sm mt-4"
          >
            {loading ? 'Processando...' : 'Finalizar Cadastro'}
          </button>
        </form>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-[#008542] font-black hover:underline underline-offset-4">
              ENTRAR AGORA
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
