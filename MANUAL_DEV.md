# Manual de Desenvolvimento - AlertOps Kanban SaaS

## Stack Tecnológica
- **Backend:** Node.js + Express
- **Frontend:** React + Vite + Tailwind CSS
- **ORM:** Prisma
- **Banco de Dados:** Neon PostgreSQL
- **Estado Global:** React Query

## Estrutura de Pastas e Arquitetura
- `/src/server/app.ts`: Lógica central do Express (Rotas e Middlewares).
- `/api/index.ts`: Entry point para Vercel Serverless.
- `/server.ts`: Entry point para desenvolvimento local (Vite Middleware).
- `/src`: Frontend React
  - `/components`: Componentes reutilizáveis
  - `/services`: APIs e serviços de frontend
  - `/lib`: Configurações de bibliotecas (Prisma, Auth, etc)
- `/prisma`: Definições de banco e migrations
- `/documents`: Documentação técnica e de progresso

## Comandos Úteis
- `npm run dev`: Inicia o servidor de desenvolvimento full-stack.
- `npx prisma generate`: Gera o cliente Prisma.
- `npx prisma migrate dev`: Cria e aplica migrations.

## Fluxo de Sincronização e Lembretes
A sincronização busca alertas com status `Assigned` na tabela `tclog_alertops.alert_events` e gera/atualiza os cards no Kanban.
- **Local:** `setInterval` no `server.ts` (60s).
- **Produção (Vercel):** Rota `/api/internal/process-reminders` disparada por Cron Job.

## Padrões de Código
- **Comentários:** Todas as funções e rotas principais devem ser comentadas (padrão JSDoc em PT-BR).
- **Segurança:** RBAC implementado via middleware `authorize(['ADMIN'])`.
- **Banco:** Sempre usar migrations para alterações de schema.
- **Integridade:** Operações financeiras ou de saldo devem usar transações Prisma.

## Endpoints de API Principais (Gestão de Agrupamentos)
- `POST /api/kanban/groups`: Cria um novo grupo.
- `POST /api/kanban/groups/:id/add-cards`: Vincula cards a um grupo existente.
- `POST /api/kanban/groups/:id/remove-cards`: Remove o vínculo de cards de um grupo.
- `DELETE /api/kanban/groups/:id`: Remove o grupo (não exclui os cards).
