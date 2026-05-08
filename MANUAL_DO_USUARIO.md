# Manual do Usuário - AlertOps

Bem-vindo ao **AlertOps**, a sua plataforma de gestão de operações, acompanhamento de alertas e controle de incidentes de TI e infraestrutura via quadros Kanban e painéis métricos avançados.

Este manual descreve todas as funcionalidades da plataforma e guiará você sobre como configurá-las e utilizá-las no dia a dia.

---

## Índice
1. [Primeiros Passos (Autenticação e Acesso)](#1-primeiros-passos-autenticação-e-acesso)
2. [Interface Principal e Menu Lateral](#2-interface-principal-e-menu-lateral)
3. [Kanban Operacional (Gestão de Cards)](#3-kanban-operacional-gestão-de-cards)
4. [Métricas (Visão Executiva)](#4-métricas-visão-executiva)
5. [Lembretes](#5-lembretes)
6. [Configurações do Sistema (Exclusivo para Administradores)](#6-configurações-do-sistema-exclusivo-para-administradores)

---

## 1. Primeiros Passos (Autenticação e Acesso)

Acesse a página de login para se autenticar ou criar uma conta.

### Criar uma Nova Conta
1. Clique em **"Cadastre-se"** na tela de login.
2. Na página de cadastro, você tem duas opções no topo:
   - **Criar Unidade:** Utilize esta opção se você é o primeiro integrante e deseja criar o ambiente (Tenant) da sua empresa do zero. Insira o nome da sua organização.
   - **Entrar com Código:** Se a sua empresa já utiliza o AlertOps, solicite o **Código de Convite** ao administrador e entre neste modo. Seu usuário será automaticamente vinculado à organização existente.
3. Preencha seus dados de identificação (Nome, E-mail, Senha e Confirmação de senha) e crie a conta.

### Login
- Para acessar a plataforma no dia a dia, preencha o E-mail e Senha registrados na tela de acesso e você será direcionado para o Painel de Controle (Dashboard).

---

## 2. Interface Principal e Menu Lateral

No modo logado (Dashboard), você possui um menu fixo na lateral com atalhos rápidos:
- **Painel:** Visão geral.
- **Métricas:** Relatórios e KPIs analíticos.
- **Kanban Operacional:** O quadro visual de gerenciamento das operações (painel de tarefas).
- **Lembretes:** Atalho para acessar todos os alarmes que você criou ou estão associados a você.
- **Configurações:** Controle de ambiente (visível apenas para papel de sistema `ADMIN`).

No menu lateral, você também pode visualizar informações do seu perfil, além da funcionalidade para desconectar da sessão ("Sair").

---

## 3. Kanban Operacional (Gestão de Cards)

O **Kanban Operacional** é o coração da plataforma. Ele permite que os times administrem alertas de monitoramento, requisições ou ordens de serviço.

### Visões do Kanban
O Kanban principal tem botões para alternar as metodologias de visão visual da tela (abas): **Kanban** (colunas), **Charts** (análise isolada do backlog) e **Agenda** (calendário em formato cronológico). Você também pode utilizar filtros rápidos por prioridade (CRÍTICO, ALERTA, INFO) e texto do card e selecionar etiquetas específicas para refinar a busca no topo.

### Movendo Cards
- Todos os cards abertos aparecerão enfileirados. 
- Mude o status do card de uma coluna para outra (Ex: de "Aguardando" para "Em Atendimento") utilizando o simples clique e arrastamento (Drag & Drop) do card sobre as demais colunas do quadro.

### Criando Cards e Grupos
- Novos Grupos de Alertas/Cards podem ser criados, auxiliando para juntar ou associar alertas similares no quadro.

### Detalhes do Card
Ao clicar em qualquer Card, será aberto o popback (modal lateral) de **Detalhamento do Card**. Dentro dele você encontra:
1. **Título, Status e Detalhes:** Possibilidade de visualizar de forma completa a descrição ou incidentes e dados vindos de integrações.
2. **Prioridade:** (Crítico, Alerta, Sucesso, Info).
3. **Responsável:** Associe a você ou outro membro da equipe à tarefa do card para clareza sobre quem está atuando no problema.
4. **Agupamentos de Alertas:** Pode associar ativamente ou remover agrupamentos criados à este ticket.
5. **Aba de Tags (Etiquetas):** Insira e diferencie labels (tags) com cores e textos personalizados para classificar os tipos de atividades (Ex: "Rede", "Software", "Físico").
6. **Aba Checklist:** Crie listas de atividades para fechar o status do Card acompanhando passos minuciosos. Eles podem ser tidos como "concluídos" via caixa de seleção ou excluídos através do painel.
7. **Aba de Comentários / Anexos:** Realize chat ou deixe anotações que todo o time conseguirá visualizar sobre do log de evento ou diagnóstico verificado do ticket.
8. **Aba de Histórico (Auditoria):** Veja em "Histórico" uma cronologia exata sobre que horas e quem editou as configurações, ou moveu sua situação na linha cronológica, sendo possível o rastreio fino das mudanças que ocorreram naquele escopo.

---

## 4. Métricas (Visão Executiva)

Ao acessar **Métricas** pelo Menu Lateral, lideranças e operadores terão acesso ao consolidado dos eventos em painéis com gráficos amigáveis.
Destaques numéricos do painel com **Dicas de Contexto ao sobrepor o mouse**:
- **Alertas Assigned:** Indicador de alertas triados aguardando as ações devidas.
- **Cards Abertos:** Somatório dos cartões ainda em acompanhamento no board.
- **MTTR Médio:** *(Mean Time to Resolution)* CÁLCULO e apresentação do seu ritmo de resposta.
- **SLA:** Conformidade geral com prazos estipulados em andamento de resolução.
- **Cards Vencidos:** Total atrasados.
- **Resolvidos:** Alertas completados no prazo rotineiro ou triados na última média.

Também no painel você tem Gráficos informando a dispersão de prioridades (Críticos/Gerais mensais).

---

## 5. Lembretes

Use este módulo se precisar ser notificado de voltar a observar um chamado depois, mas caso esqueça:
- No pop-up de detalhes do Card ou no atalho Lembretes.
- Visualize todas notificações em linha temporal e decida se irá focar no status atual listado do AlertOps ou postergar uma atividade com nova programação de horário para um agendamento.
- Despache e gerencie Lembretes Concluídos.
- É ideal para gerenciar interações com parceiros terceirizados ("Verificar atualização do fornecedor de link de dados").

---

## 6. Configurações do Sistema (Exclusivo para Administradores)

Usuários que detém o controle do cargo corporativo nível **"ADMIN"** possuem o atalho "Configurações" habilitado. Ele gerencia as premissas gerais do tenant com 4 guias principais.

### Aba 1: Geral
- **Nome da Unidade:** Mude livremente o identificador rotulado que toda a equipe lê, salvando as definições.
- **Código de Convite:** Encontre, altere e copie o código numérico global ("ex: TRP-2026"). Este é o código necessário pelos seus Operadores no momento do registro.

### Aba 2: Colunas do Kanban
- Controle integral do ciclo do Pipeline de Incidentes.
- **Criar Coluna de Fluxo:** Determine nomes textuais (Ex: "Aguardando Chamado", "Triagem N1") com cores sólidas que facilitem o rastreio de visão para seus colaboradores.
- **Editar e Renomear:** Modificando a qualquer tempo.
- **Reordenar:** Aponte usando as setas para baixo / para cima.
- **Mapear Indicadores Finais ou Iniciais:** Selecione "Marcar Inicial" e "Marcar Final". As métricas analisam cards que transitam nestes estados (Entrada para as métricas do card, "Finalizado" para encerramento de SLAs).
- Apague seções obsoletas com o ícone excluir.

### Aba 3: Usuários (Gestão de Equipe)
- Listagem dos nomes, e-mails de acesso atuais da organização.
- **Nível de Acesso:** Determine e Edite hierarquias da plataforma (`ADMIN`, `GESTOR`, `OPERADOR`).
- **Adicionar Membros:** Alternativa rápida para forçar e registrar imediatamente membros passivos estipulando-os senhas manuais.
- Utilize a lata de lixo "Excluir" para revogar as concessões gerais no login logado, banindo um acesso irregular de antigos colaboradores operacionais do seu tenant logico.

### Aba 4: Integrações
Gerencie interfaces e Webhooks que enviarão chamadas (Alertas) do seu monitoramento real na rede conectando em Webhooks nativos ou provedores via cloud nativa para ingestão proativa de ocorrências dentro do Dashboard / Kanban.
