# Changelog - AlertOps Kanban SaaS

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
