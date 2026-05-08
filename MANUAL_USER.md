# Manual do Usuário - AlertOps Kanban SaaS

## Bem-vindo
Esta plataforma foi desenvolvida para ajudar a equipe operacional da Transpetro a gerenciar alertas vindos do AlertOps de forma visual e organizada.

## Funcionalidades Principais

### Kanban Board
- **Visualize seus alertas:** Cada card no Kanban representa um alerta Assigned no AlertOps.
- **Movimentação:** Arraste e solte cards entre as colunas para atualizar o status (Novo, Em Triagem, Em Tratativa, etc).
- **Detalhes:** Clique em um card para ver a descrição detalhada, tópicos, JSONs técnicos e histórico de movimentação.

### Dashboard
- Acompanhe métricas em tempo real:
  - Total de alertas Assigned.
  - Alertas próximos do vencimento (SLA).
  - Tempo médio de resolução.
  - Distribuição por criticidade.

### Sincronização
- Os alertas são sincronizados automaticamente. No entanto, se precisar de uma atualização imediata, um administrador pode disparar a sincronização manual na área de configurações.

## Roles e Permissões
- **ADMIN:** Controle total sobre usuários e configurações.
- **MANAGER:** Visualiza dashboards e movimenta cards.
- **OPERATOR:** Comenta e movimenta cards atribuídos.
- **VIEWER:** Apenas visualização.
