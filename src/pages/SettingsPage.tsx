import { useState } from 'react';
import { Shield, Bell, Palette, Globe, Server, Layout, Plus, Trash2, ChevronUp, ChevronDown, Save, AlertTriangle, CheckCircle2, Users, UserPlus, Mail, ShieldCheck, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function SettingsNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-all",
        active ? "bg-[#f0f9f4] text-[#008542] shadow-sm" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      {icon} {label}
    </button>
  );
}

function CustomSelect({ value, onChange, options, label }: { value: string, onChange: (val: string) => void, options: { value: string, label: string }[], label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative">
      {label && <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-700 uppercase tracking-widest hover:border-[#008542] transition-all outline-none focus:ring-1 focus:ring-[#008542]"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors",
                    value === option.value 
                      ? "bg-[#f0f9f4] text-[#008542]" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserListItem({ user, updateUserMutation, deleteUserMutation, confirmDeleteUserId, setConfirmDeleteUserId }: { 
  user: any, 
  updateUserMutation: any, 
  deleteUserMutation: any, 
  confirmDeleteUserId: string | null, 
  setConfirmDeleteUserId: (id: string | null) => void 
}) {
  return (
    <div key={user.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl group transition-all shadow-sm">
      <div className="w-10 h-10 rounded-full bg-[#f0f9f4] flex items-center justify-center text-[#008542] border border-[#008542]/10 font-black text-xs">
        {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{user.name}</h4>
          <span className={cn(
            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
            user.role === 'ADMIN' ? "bg-red-100 text-red-600" : user.role === 'MANAGER' ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-600"
          )}>
            {user.role}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            <Mail size={12} /> {user.email}
          </span>
          <span className="text-slate-200">|</span>
          <span className={cn(
            "flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter",
            user.is_active !== false ? "text-slate-400" : "text-red-500"
          )}>
            {user.is_active !== false ? <ShieldCheck size={12} /> : <X size={12} />} 
            {user.is_active !== false ? 'Membro Ativo' : 'Acesso Desativado'}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-4 w-48">
        <CustomSelect 
          value={user.role}
          onChange={(val) => updateUserMutation.mutate({ id: user.id, data: { role: val } })}
          options={[
            { value: 'OPERATOR', label: 'OPERADOR' },
            { value: 'MANAGER', label: 'GESTOR' },
            { value: 'ADMIN', label: 'ADMIN' },
          ]}
        />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={cn("text-[8px] font-black uppercase tracking-widest", user.is_active !== false ? "text-[#008542]" : "text-slate-400")}>
              {user.is_active !== false ? 'Ativo' : 'Inativo'}
            </span>
            <button 
              onClick={() => updateUserMutation.mutate({ id: user.id, data: { is_active: user.is_active === false } })}
              className={cn(
                "w-9 h-5 rounded-full relative transition-colors duration-300 outline-none",
                user.is_active !== false ? "bg-[#008542]" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 shadow-sm",
                user.is_active !== false ? "translate-x-4" : "translate-x-0"
              )} />
            </button>
          </div>

          {confirmDeleteUserId === user.id ? (
            <div className="flex flex-col gap-2 p-2 bg-red-50 border border-red-100 rounded-lg animate-in slide-in-from-right-2">
              <p className="text-[8px] font-bold text-red-600 uppercase leading-tight max-w-[150px]">
                Atenção: A exclusão física falhará se o usuário possuir histórico. Prefira desativar.
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => deleteUserMutation.mutate(user.id)}
                  className="p-1 px-3 bg-red-600 text-white text-[9px] font-black rounded uppercase shadow-sm hover:bg-red-700"
                >
                  EXCLUIR
                </button>
                <button 
                  onClick={() => setConfirmDeleteUserId(null)}
                  className="p-1 px-3 bg-slate-200 text-slate-600 text-[9px] font-black rounded uppercase hover:bg-slate-300"
                >
                  NÃO
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setConfirmDeleteUserId(user.id)}
              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              title="Excluir Permanentemente"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'geral' | 'kanban' | 'users' | 'integrations'>('geral');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';
  
  if (!isAdmin) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield size={40} className="text-red-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Acesso Negado</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8 italic">
            Esta área é restrita para Administradores da plataforma. Entre em contato com o gestor da sua unidade para solicitar alterações.
          </p>
          <a href="/dashboard" className="inline-block w-full py-3 bg-[#008542] text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-[#006b35] transition-colors">
            Voltar para o Início
          </a>
        </div>
      </div>
    );
  }
  
  // Status States
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#64748b');

  // User Management States
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('OPERATOR');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [tempCode, setTempCode] = useState('');
  const [isEditingTenantName, setIsEditingTenantName] = useState(false);
  const [tempTenantName, setTempTenantName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const queryClient = useQueryClient();

  // --- QUERIES ---
  const { data: statuses, isLoading: isLoadingStatuses } = useQuery({
    queryKey: ['kanban-statuses'],
    queryFn: async () => {
      const res = await fetch('/api/kanban/statuses', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar status');
      return res.json();
    }
  });

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar usuários');
      return res.json();
    }
  });

  // --- STATUS MUTATIONS ---
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/kanban/statuses/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Falha ao atualizar status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-statuses'] });
      toast.success('Status atualizado!');
    }
  });

  const createStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/kanban/statuses', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Falha ao criar status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-statuses'] });
      toast.success('Novo status criado!');
    }
  });

  const deleteStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kanban/statuses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao excluir status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-statuses'] });
      toast.success('Status removido');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const reorderStatusesMutation = useMutation({
    mutationFn: async (order: { id: string, position: number }[]) => {
      const res = await fetch('/api/kanban/statuses/reorder', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ order })
      });
      if (!res.ok) throw new Error('Falha ao reordenar status');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kanban-statuses'] })
  });

  // --- USER MUTATIONS ---
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao criar usuário');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso!');
      setIsAddingUser(false);
      resetUserForm();
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Falha ao atualizar usuário');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado!');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}?hard=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao excluir usuário permanentemente');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário removido permanentemente.');
      setConfirmDeleteUserId(null);
    },
    onError: (error: Error) => {
      console.error('Erro na deleção:', error);
      toast.error(error.message || 'Erro inesperado ao remover usuário.');
    }
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: { name?: string, code?: string }) => {
      const res = await fetch('/api/tenant/info', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao atualizar organização');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] });
      toast.success('Informações atualizadas!');
      setIsEditingCode(false);
      setIsEditingTenantName(false);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const { data: tenantInfo } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: async () => {
      const res = await fetch('/api/tenant/info', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar info do tenant');
      return res.json();
    }
  });

  // --- HANDLERS ---
  const resetUserForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('OPERATOR');
    setNewUserPassword('');
  };

  const handleAddUser = () => {
    if (!newUserName || !newUserEmail) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    createUserMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword || 'password123',
      role: newUserRole
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!statuses) return;
    const newStatuses = [...statuses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStatuses.length) return;
    [newStatuses[index], newStatuses[targetIndex]] = [newStatuses[targetIndex], newStatuses[index]];
    const order = newStatuses.map((s, idx) => ({ id: s.id, position: idx }));
    reorderStatusesMutation.mutate(order);
  };

  const handleAddStatus = () => {
    if (!newName.trim()) { toast.error('Nome é obrigatório'); return; }
    createStatusMutation.mutate({ name: newName, color: newColor, position: statuses?.length || 0 });
    setIsAddingNew(false); setNewName(''); setNewColor('#64748b');
  };

  const handleDeleteStatus = (id: string) => {
    deleteStatusMutation.mutate(id, { onSuccess: () => setConfirmDeleteId(null) });
  };

  const handleUpdateStatus = (id: string, field: string, value: any) => {
    updateStatusMutation.mutate({ id, data: { [field]: value } });
    setEditingStatusId(null);
  };

  return (
    <div className="p-8 max-w-5xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações do Sistema</h1>
        <p className="text-slate-500 text-sm">Gerencie as preferências da plataforma e integridade das conexões.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-1">
           <SettingsNavItem icon={<Globe size={18} />} label="Geral" active={activeTab === 'geral'} onClick={() => setActiveTab('geral')} />
           <SettingsNavItem icon={<Layout size={18} />} label="Colunas do Kanban" active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} />
           <SettingsNavItem icon={<Users size={18} />} label="Usuários" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
           <SettingsNavItem icon={<Server size={18} />} label="Integrações" active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} />
        </div>

        <div className="md:col-span-3 space-y-6">
           {activeTab === 'geral' && (
             <div className="space-y-6 animate-in fade-in duration-300">
             <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Informações da Unidade</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome da Organização</label>
                      <div className="flex items-center gap-2">
                        {isEditingTenantName ? (
                          <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-2">
                            <input 
                              type="text" 
                              value={tempTenantName} 
                              onChange={(e) => setTempTenantName(e.target.value)}
                              className="flex-1 px-4 py-2.5 bg-white border-2 border-[#008542] rounded-lg text-xs font-bold text-slate-900 outline-none"
                              autoFocus
                            />
                            <button 
                              onClick={() => updateTenantMutation.mutate({ name: tempTenantName })}
                              className="p-2.5 bg-[#008542] text-white rounded-lg hover:bg-[#006b35]"
                            >
                              <Save size={16} />
                            </button>
                            <button 
                              onClick={() => setIsEditingTenantName(false)}
                              className="p-2.5 bg-slate-200 text-slate-500 rounded-lg"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <input type="text" readOnly value={tenantInfo?.name || "Carregando..."} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-800 outline-none" />
                            <button 
                              onClick={() => {
                                setTempTenantName(tenantInfo?.name || '');
                                setIsEditingTenantName(true);
                              }}
                              className="p-2.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <Plus size={14} className="rotate-45" />
                            </button>
                          </>
                        )}
                      </div>
                   </div>
                   <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Slug do Sistema</label>
                      <input type="text" readOnly value={tenantInfo?.slug || "Carregando..."} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono text-slate-400 outline-none" />
                   </div>
                </div>
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <Users className="text-[#008542]" size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Código de Convite</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Membros precisam deste código para se registrar nesta unidade.</p>
                        </div>
                        {!isEditingCode && (
                          <button 
                            onClick={() => {
                              setTempCode(tenantInfo?.code || '');
                              setIsEditingCode(true);
                            }}
                            className="text-[9px] font-black text-[#008542] uppercase tracking-widest hover:underline"
                          >
                            Alterar Código
                          </button>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center gap-3">
                        {isEditingCode ? (
                          <div className="flex items-center gap-2 flex-1 max-w-xs animate-in slide-in-from-left-2">
                            <input 
                              type="text" 
                              value={tempCode} 
                              onChange={(e) => setTempCode(e.target.value.toUpperCase())}
                              className="flex-1 px-4 py-2 bg-white border-2 border-[#008542] rounded-lg text-lg font-black tracking-[0.2em] text-[#008542] outline-none"
                              autoFocus
                            />
                            <button 
                              onClick={() => updateTenantMutation.mutate({ code: tempCode })}
                              className="p-2.5 bg-[#008542] text-white rounded-lg hover:bg-[#006b35] shadow-lg shadow-[#008542]/20"
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              onClick={() => setIsEditingCode(false)}
                              className="p-2.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <code className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-lg font-black tracking-[0.2em] text-[#008542]">
                              {tenantInfo?.code || "------"}
                            </code>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(tenantInfo?.code || '');
                                toast.success('Código copiado!');
                              }}
                              className="p-2.5 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-[#008542]"
                              title="Copiar código"
                            >
                              <Save size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
               </div>
             </section>
           </div>
         )}

           {activeTab === 'kanban' && (
             <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Gestão de Colunas (Status)</h3>
                   <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Defina as fases do fluxo de trabalho</p>
                 </div>
                 <button 
                   onClick={() => setIsAddingNew(true)}
                   className="flex items-center gap-2 px-3 py-1.5 bg-[#008542] text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-green-800 transition-colors"
                 >
                   <Plus size={14} /> Nova Coluna
                 </button>
               </div>

               {isAddingNew && (
                 <div className="mb-6 p-4 bg-slate-50 border border-[#008542]/20 rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <h4 className="text-[10px] font-black text-[#008542] uppercase tracking-widest mb-3">Nova Coluna de Fluxo</h4>
                    <div className="flex flex-col md:flex-row gap-3">
                      <input type="text" placeholder="Nome da coluna" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none" autoFocus />
                      <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-12 h-10 border border-slate-200 rounded-lg cursor-pointer p-1" />
                      <div className="flex gap-2">
                        <button onClick={() => setIsAddingNew(false)} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 rounded-lg">Cancelar</button>
                        <button onClick={handleAddStatus} className="px-4 py-2 bg-[#008542] text-white text-[10px] font-black uppercase rounded-lg shadow-sm">Criar Status</button>
                      </div>
                    </div>
                 </div>
               )}

               <div className="space-y-3">
                 {isLoadingStatuses ? (
                   <p className="text-xs text-slate-400 font-bold uppercase italic">Carregando fluxos...</p>
                 ) : (
                   statuses?.map((status: any, index: number) => (
                     <div key={status.id} className="relative">
                       <div className={cn("flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 group", confirmDeleteId === status.id ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-100")}>
                         <div className="flex flex-col gap-1">
                           <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-slate-300 hover:text-[#008542] disabled:opacity-0"><ChevronUp size={16} /></button>
                           <button onClick={() => handleMove(index, 'down')} disabled={index === statuses.length - 1} className="p-1 text-slate-300 hover:text-[#008542] disabled:opacity-0"><ChevronDown size={16} /></button>
                         </div>
                         <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                         <div className="flex-1 min-w-0">
                           {editingStatusId === status.id ? (
                             <input type="text" defaultValue={status.name} className="flex-1 px-2 py-1 text-sm font-bold border border-slate-200 rounded outline-none" onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateStatus(status.id, 'name', (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingStatusId(null); }} onBlur={(e) => handleUpdateStatus(status.id, 'name', e.target.value)} autoFocus />
                           ) : (
                             <div className="flex items-center gap-2">
                               <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter truncate">{status.name}</h4>
                               {status.is_initial && <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase">Inicial</span>}
                               {status.is_final && <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded uppercase">Final</span>}
                             </div>
                           )}
                           <div className="flex gap-3 mt-1">
                             <button onClick={() => setEditingStatusId(status.id)} className="text-[9px] font-bold text-slate-400 hover:text-[#008542] uppercase tracking-widest">Renomear</button>
                             <div className="flex items-center gap-2">
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cor:</span>
                               <input type="color" value={status.color} onChange={(e) => handleUpdateStatus(status.id, 'color', e.target.value)} className="w-4 h-4 rounded-full border border-slate-200 cursor-pointer p-0" />
                             </div>
                             <button onClick={() => updateStatusMutation.mutate({ id: status.id, data: { is_initial: !status.is_initial } })} className={cn("text-[9px] font-bold uppercase tracking-widest", status.is_initial ? "text-blue-500" : "text-slate-400 hover:text-blue-500")}>Marcar Inicial</button>
                             <button onClick={() => updateStatusMutation.mutate({ id: status.id, data: { is_final: !status.is_final } })} className={cn("text-[9px] font-bold uppercase tracking-widest", status.is_final ? "text-emerald-500" : "text-slate-400 hover:text-emerald-500")}>Marcar Final</button>
                           </div>
                         </div>
                         {confirmDeleteId === status.id ? (
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] font-black text-red-500 uppercase">Confirmar?</span>
                             <button onClick={() => handleDeleteStatus(status.id)} className="p-1.5 bg-red-500 text-white rounded-md"><CheckCircle2 size={14} /></button>
                             <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-md"><Trash2 size={14} className="rotate-45" /></button>
                           </div>
                         ) : (
                           <button onClick={() => setConfirmDeleteId(status.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                         )}
                       </div>
                     </div>
                   ))
                 )}
               </div>

               <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-800">
                  <AlertTriangle className="shrink-0" size={20} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight">Aviso de Segurança</p>
                    <p className="text-[10px] font-bold opacity-80 uppercase leading-relaxed mt-1">
                      A exclusão de colunas é uma operação sensível. Cards vinculados a colunas excluídas podem ficar inacessíveis se o processo não for respeitado. Mova os cards antes de deletar uma coluna.
                    </p>
                  </div>
               </div>
             </section>
           )}

           {activeTab === 'users' && (
             <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Gestão de Equipe</h3>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Controle de acesso e permissões da unidade</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingUser(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#008542] text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-green-800 transition-colors"
                  >
                    <UserPlus size={14} /> Adicionar Membro
                  </button>
                </div>

                {isAddingUser && (
                  <div className="mb-6 p-6 bg-slate-50 border border-[#008542]/20 rounded-xl animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Cadastrar Novo Membro</h4>
                      <button onClick={() => setIsAddingUser(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
                        <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#008542]" placeholder="Ex: João Silva" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">E-mail Corporativo</label>
                        <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#008542]" placeholder="email@exemplo.com" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sua Senha Inicial</label>
                        <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-[#008542]" placeholder="No mínimo 6 caracteres" />
                      </div>
                      <CustomSelect 
                        label="Nível de Acesso"
                        value={newUserRole}
                        onChange={setNewUserRole}
                        options={[
                          { value: 'OPERATOR', label: 'OPERADOR (Padrão)' },
                          { value: 'MANAGER', label: 'GESTOR (Visualizar Relatórios)' },
                          { value: 'ADMIN', label: 'ADMINISTRADOR (Controle Total)' },
                        ]}
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                       <button onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 rounded-lg">Cancelar</button>
                       <button onClick={handleAddUser} className="px-6 py-2 bg-[#008542] text-white text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-green-800 transition-colors">Confirmar Cadastro</button>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                   {isLoadingUsers ? (
                     <p className="text-xs text-slate-400 font-bold uppercase italic">Sincronizando usuários...</p>
                   ) : (
                     <>
                       {/* MEMBROS ATIVOS */}
                       <div className="space-y-3">
                         <div className="flex items-center gap-2 mb-2">
                           <ShieldCheck size={14} className="text-[#008542]" />
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Membros Ativos ({users?.filter((u: any) => u.is_active !== false).length})</h4>
                         </div>
                         {users?.filter((u: any) => u.is_active !== false).map((user: any) => (
                           <UserListItem 
                            key={user.id} 
                            user={user} 
                            updateUserMutation={updateUserMutation}
                            deleteUserMutation={deleteUserMutation}
                            confirmDeleteUserId={confirmDeleteUserId}
                            setConfirmDeleteUserId={setConfirmDeleteUserId}
                           />
                         ))}
                       </div>

                       {/* MEMBROS ARQUIVADOS */}
                       {users?.filter((u: any) => u.is_active === false).length > 0 && (
                         <div className="mt-8 border-t border-slate-100 pt-6">
                           <button 
                             onClick={() => setShowArchived(!showArchived)}
                             className="flex items-center justify-between w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
                           >
                             <div className="flex items-center gap-2">
                               <Trash2 size={14} className="text-slate-400" />
                               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Membros Arquivados ({users?.filter((u: any) => u.is_active === false).length})</h4>
                             </div>
                             <ChevronRight size={16} className={cn("text-slate-300 transition-transform duration-300", showArchived && "rotate-90")} />
                           </button>

                           <AnimatePresence>
                             {showArchived && (
                               <motion.div 
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: 'auto', opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 className="overflow-hidden"
                               >
                                 <div className="space-y-3 pt-4">
                                   {users?.filter((u: any) => u.is_active === false).map((user: any) => (
                                     <UserListItem 
                                      key={user.id} 
                                      user={user} 
                                      updateUserMutation={updateUserMutation}
                                      deleteUserMutation={deleteUserMutation}
                                      confirmDeleteUserId={confirmDeleteUserId}
                                      setConfirmDeleteUserId={setConfirmDeleteUserId}
                                     />
                                   ))}
                                 </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                         </div>
                       )}
                     </>
                   )}
                 </div>
             </section>
           )}

           {activeTab === 'integrations' && (
             <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
               <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Integrações de API</h3>
               <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                 <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Server size={20} className="text-slate-300" />
                 </div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Módulo de integrações em desenvolvimento</p>
               </div>
             </section>
           )}

           <div className="flex justify-end gap-3 pt-4">
               <button className="px-6 py-2 bg-slate-200 text-slate-600 font-bold rounded-md text-xs hover:bg-slate-300 transition-colors uppercase tracking-widest">Fechar</button>
               <button 
                 onClick={() => toast.success('Configurações aplicadas com sucesso.')}
                 className="px-8 py-2 bg-[#008542] text-[#ffcc00] font-black rounded-md text-xs hover:bg-green-900 shadow-md transition-all active:scale-95 uppercase tracking-widest"
               >
                 Salvar Alterações
               </button>
           </div>
        </div>
      </div>
    </div>
  );
}


