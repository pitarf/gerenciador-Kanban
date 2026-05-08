# Changelog - AlertOps Kanban SaaS

## [1.1.4] - 2026-05-08
### ✅ Concluído
- [x] **Filtros Operacionais:** Restrição global de usuários em menções (`@`), comentários e atribuições de lembretes para exibir apenas contas ativas.
- [x] **API:** Adicionado suporte ao parâmetro `active=true` na rota `/api/users`.

## [1.1.3] - 2026-05-08
### ✅ Concluído
- [x] **Sistema de Notificações:** Implementado backend completo (`GET`, `PATCH /read`, `PATCH /read-all`) e nova página de Histórico de Notificações.
- [x] **Lembretes:** Adicionada confirmação visual para exclusão de lembretes e renomeado status "Pendente" para "Aguardando".
- [x] **UI/UX:** Corrigidos bugs de importação de ícones e referências de componentes (toast).
- [x] **Documentação:** Manuais de usuário (`MANUAL_USER.md` e `MANUAL_DO_USUARIO.md`) totalmente atualizados com as novas funcionalidades.

## [1.1.2] - 2026-05-08
### ✅ Concluído
- [x] UI/Backend: Gestão de Usuários com Desativação (Soft Delete) e bloqueio de login.
- Sistema de "Links Amigáveis" na visualização de detalhes: URLs longas do Power BI, Grafana e AlertOps agora são exibidas como rótulos limpos (ex: "Ir para o Power BI").
- Gestão de Usuários: Substituída a exclusão física por "Desativação" (Soft Delete) para preservar histórico e integridade referencial.
- UI: Implementado diálogo de confirmação visual para desativação de usuários.
- Segurança: Bloqueio automático de login para contas desativadas.
- [x] UI: Botão de navegação rápida entre cards agrupados.
- [x] API: Endpoint `POST /api/kanban/groups/:id/add-cards` implementado.
- [x] Backend: Implementada lógica de `prisma.$transaction` em endpoints críticos.

### Investigação
- Confirmado que os logs de chat são persistidos no disco local; o problema relatado é de renderização na UI do Antigravity.

## [1.1.1] - 2026-05-08
### Adicionado
- Configuração de deploy para Vercel (`vercel.json`, `api/index.ts`).
- Rota interna `/api/internal/process-reminders` para Cron Jobs na Vercel.
- Comentários detalhados em todas as rotas e funções do backend.

### Alterado
- Refatoração da arquitetura do servidor: a lógica do Express foi movida para `src/server/app.ts`.
- `server.ts` agora é o entry point exclusivo para desenvolvimento local.
- Melhoria no dashboard de métricas para garantir estabilidade no deploy.

## [1.1.0] - 2026-05-08
### Adicionado
- Trava de segurança (RBAC) no Backend e Frontend para acesso à página de Settings (apenas Admins).
- Funcionalidade de editar Nome e Código da Unidade diretamente nas Configurações.
- Tooltips informativos nos cards de métricas do Dashboard.
- Manual do Usuário (`MANUAL_DO_USUARIO.md`) detalhado.

### Modificado
- Dashboard de Métricas atualizado com cálculos reais (simulados) de MTTR e SLA.
- Refinamentos visuais seguindo o padrão "Swiss/Modern".

## [1.0.0] - 2026-04-30

### Adicionado
- Implementação completa do Kanban Board com Drag & Drop (@hello-pangea/dnd).
- Dashboard de métricas com Recharts (Total, Aberto, Vencido, Resolvido).
- Sistema de autenticação JWT com Roles (ADMIN, MANAGER, OPERATOR, VIEWER).
- Serviço de sincronização AlertOps (Raw -> Normalized -> Kanban).
- Interface Premium com identidade Transpetro (Verde/Amarelo).
- Funcionalidade de Drawer de detalhes com dados técnicos (JSONs).
- Documentação de Usuário e Desenvolvedor.
