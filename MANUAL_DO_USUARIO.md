# 📖 Manual do Usuário - AlertOps Kanban SaaS

Bem-vindo ao **AlertOps**, sua plataforma avançada para gestão de incidentes, monitoramento de alertas e controle operacional via quadros Kanban e painéis métricos inteligentes.

Este manual guiará você por todas as funcionalidades, desde o acesso inicial até a configuração avançada do ambiente.

---

## 📑 Índice
1. [Acesso e Autenticação](#1-acesso-e-autenticação)
2. [Interface e Navegação](#2-interface-e-navegação)
3. [Kanban Operacional (O Coração do Sistema)](#3-kanban-operacional)
4. [Central de Notificações](#4-central-de-notificações)
5. [Gestão de Lembretes](#5-gestão-de-lembretes)
6. [Métricas e Performance](#6-métricas-e-performance)
7. [Configurações e Administração](#7-configurações-e-administração)

---

## 🔐 1. Acesso e Autenticação
O AlertOps utiliza um sistema de multi-inquilinato (Tenants). Você pode entrar em uma organização existente ou criar a sua própria.

- **Cadastro de Unidade:** Se sua empresa é nova no sistema, use esta opção para criar um ambiente isolado.
- **Entrar com Código:** Use o **Código de Convite** fornecido pelo seu administrador para se vincular a uma equipe já existente.
- **Segurança:** Todas as senhas são criptografadas e o acesso é protegido por tokens de sessão (JWT).

---

## 🎨 2. Interface e Navegação
A interface foi projetada para ser intuitiva e rápida:
- **Menu Lateral:** Acesso rápido ao Dashboard, Kanban, Lembretes e Configurações.
- **Modo Escuro:** Alterne entre temas claro e escuro para melhor conforto visual.
- **Busca Global:** Encontre qualquer alerta instantaneamente pelo título ou ID.

---

## 📋 3. Kanban Operacional
Onde a operação acontece. Visualize e mova alertas entre diferentes estágios.

### Cards de Alerta
Cada card contém informações vitais:
- **Prioridade:** Identificada por cores (Crítico, Alerta, Info).
- **Responsável:** Atribua cards a si mesmo ou a colegas.
- **Ações Rápidas:** Links para ferramentas externas (Power BI, Grafana) são convertidos em botões amigáveis.

### Detalhes do Card (Gaveta Lateral)
- **Checklists:** Divida a resolução em passos práticos.
- **Comentários e Menções:** Use `@nome` para notificar alguém específico ou `@todos` para alertar toda a equipe do card.
- **Anexos:** Envie logs, prints e documentos diretamente para o card.
- **Lembretes:** Agende alertas específicos para o card diretamente desta aba para não esquecer retornos importantes.
- **Histórico (Auditoria):** Veja quem moveu o card, quando e quais alterações foram feitas.

---

## 🔔 4. Central de Notificações
Localizada no topo (ícone de sino), mantém você atualizado sem interromper seu fluxo.

- **Filtros Rápidos:** Veja apenas o que não foi lido ou pesquise por termos específicos.
- **Ler Tudo:** Botão para limpar suas notificações pendentes com um clique.
- **Histórico de Notificações:** Uma página dedicada para revisar alertas passados, menções em comentários e atualizações de sistema.

---

## ⏰ 5. Gestão de Lembretes
Ferramenta essencial para não esquecer de retornos ou verificações periódicas.

- **Status "Aguardando":** Lembretes que ainda não venceram ou estão aguardando ação.
- **Status "Concluídos":** Histórico de lembretes já processados.
- **Agendamento Inteligente:** Defina prazos rápidos (+30m, +1h) ou datas customizadas.
- **Segurança de Dados:** A exclusão de lembretes possui uma **confirmação visual** para evitar perda acidental de agendamentos importantes.

---

## 📈 6. Métricas e Performance
Acompanhe a saúde da sua operação em tempo real.

- **MTTR (Tempo Médio de Resolução):** Quanto tempo sua equipe leva, em média, para encerrar um alerta.
- **Conformidade de SLA:** Porcentagem de incidentes resolvidos dentro do prazo acordado.
- **Volume por Dia:** Gráficos que mostram os picos de incidentes durante a semana.

---

## ⚙️ 7. Configurações e Administração
Reservado para usuários com nível **ADMIN**.

- **Branding Personalizado:** Altere o nome da unidade, descrição do site e Favicon (ícone da aba do navegador).
- **Gestão de Equipe:** Adicione novos membros, altere níveis de acesso ou desative usuários (preservando o histórico de ações).
- **Estrutura do Kanban:** Crie, renomeie, reordene ou exclua colunas do seu fluxo de trabalho.
- **Integrações:** Configure Webhooks para receber alertas automáticos de ferramentas externas.

---
*Manual atualizado em: 08 de Maio de 2026. Versão 2.5*
