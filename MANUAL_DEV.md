# Manual de Desenvolvimento - AlertOps Kanban SaaS

## Stack Tecnológica
- **Backend:** Node.js + Express
- **Frontend:** React + Vite + Tailwind CSS
- **ORM:** Prisma
- **Banco de Dados:** Neon PostgreSQL
- **Estado Global:** React Query

## Estrutura de Pastas
- `/src`: Frontend React
  - `/components`: Componentes reutilizáveis
  - `/services`: APIs e serviços de frontend
  - `/lib`: Configurações de bibliotecas (Prisma client frontend, etc)
- `/server.ts`: Ponto de entrada do servidor full-stack
- `/prisma`: Definições de banco e migrations
- `/documents`: Documentação técnica e de progresso

## Comandos Úteis
- `npm run dev`: Inicia o servidor de desenvolvimento full-stack.
- `npx prisma generate`: Gera o cliente Prisma.
- `npx prisma migrate dev`: Cria e aplica migrations.

## Fluxo de Sincronização
O serviço de sincronização lê da tabela `tclog_alertops.alert_events` registros com status 'Assigned' e realiza um upsert na tabela `alertops_alerts`. Em seguida, cria ou atualiza os `cards` vinculados.
