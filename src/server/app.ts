import express from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { generateToken, authenticate, AuthRequest, authorize } from '../lib/auth';
import { syncAssignedAlertOpsAlerts } from '../services/alertops/alertops-sync.service';

/**
 * ARQUIVO: src/server/app.ts
 * DESCRIÇÃO: Configuração central da aplicação Express. 
 * Este arquivo isola a lógica de rotas e middlewares para permitir o uso 
 * tanto no servidor local quanto como Serverless Function na Vercel.
 */

const app = express();
app.use(express.json());

// --- PUBLIC API ---

/**
 * Rota de Health Check
 * Verifica se a API está online e respondendo.
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Registro de Usuário e Organização (Tenant)
 * Cria um novo tenant se join_code não for fornecido, ou associa o usuário 
 * a um tenant existente caso o código seja válido.
 */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, tenant_name, join_code } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está em uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let tenantId: string;
    let userRole: string = 'ADMIN';

    if (join_code) {
      const existingTenant = await prisma.tenant.findUnique({ where: { code: join_code } });
      if (!existingTenant) {
        return res.status(404).json({ error: 'Código de organização inválido' });
      }
      tenantId = existingTenant.id;
      userRole = 'OPERATOR';
    } else {
      // Criação de novo Tenant (Organização)
      const slug = (tenant_name || name).toLowerCase().replace(/[^a-z0-9]/g, '-');
      const tenant = await prisma.tenant.create({
        data: {
          name: tenant_name || `Tenant de ${name}`,
          slug: `${slug}-${Math.random().toString(36).substring(2, 7)}`,
          code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        }
      });
      tenantId = tenant.id;

      // Inicializa colunas padrão para o novo Kanban
      await prisma.cardStatus.createMany({
        data: [
          { tenant_id: tenantId, name: 'Aguardando', slug: 'backlog', color: '#64748b', position: 0, is_initial: true },
          { tenant_id: tenantId, name: 'Em Atendimento', slug: 'todo', color: '#008542', position: 1 },
          { tenant_id: tenantId, name: 'Pendente', slug: 'doing', color: '#ffcc00', position: 2 },
          { tenant_id: tenantId, name: 'Encerrado', slug: 'done', color: '#0ea5e9', position: 3, is_final: true },
        ]
      });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        role: userRole,
        tenant_id: tenantId
      }
    });

    const token = generateToken({
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
      name: user.name
    });

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao realizar cadastro' });
  }
});

/**
 * Login de Usuário
 * Valida credenciais e retorna um token JWT.
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = generateToken({
      id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
      name: user.name
    });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// --- PROTECTED API (Middleware 'authenticate' obrigatório) ---

/**
 * Retorna dados do usuário autenticado
 */
app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

/**
 * Lista usuários da mesma organização (Tenant)
 */
app.get('/api/users', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenant_id: req.user!.tenant_id },
      select: { id: true, name: true, email: true, role: true, created_at: true }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar usuários' });
  }
});

/**
 * Cria novo usuário (Apenas ADMIN)
 */
app.post('/api/users', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está em uso' });
    }

    const hashedPassword = await bcrypt.hash(password || 'password123', 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        role: role || 'OPERATOR',
        tenant_id: req.user!.tenant_id
      },
      select: { id: true, name: true, email: true, role: true }
    });
    res.status(201).json(user);
  } catch (error) {
    console.error('SERVER ERROR [POST /api/users]:', error);
    res.status(500).json({ error: 'Falha ao criar usuário' });
  }
});

/**
 * Atualiza usuário (Apenas ADMIN)
 */
app.patch('/api/users/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, role } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id, tenant_id: req.user!.tenant_id },
      data: { name, role },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(user);
  } catch (error) {
    console.error('SERVER ERROR [PATCH /api/users/:id]:', error);
    res.status(500).json({ error: 'Falha ao atualizar usuário' });
  }
});

/**
 * Remove usuário (Apenas ADMIN)
 */
app.delete('/api/users/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Você não pode remover seu próprio acesso.' });
    }
    await prisma.user.delete({
      where: { id, tenant_id: req.user!.tenant_id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('SERVER ERROR [DELETE /api/users/:id]:', error);
    res.status(500).json({ error: 'Falha ao remover usuário' });
  }
});

// KANBAN CARDS

/**
 * Busca informações da Organização (Tenant)
 */
app.get('/api/tenant/info', authenticate, async (req: AuthRequest, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenant_id }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar informações do tenant' });
  }
});

/**
 * Atualiza configurações da Organização (Apenas ADMIN)
 */
app.patch('/api/tenant/info', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { name, code } = req.body;
  try {
    if (code) {
      const existingWithCode = await prisma.tenant.findFirst({
        where: { 
          code: { equals: code, mode: 'insensitive' },
          id: { not: req.user!.tenant_id }
        }
      });
      if (existingWithCode) {
        return res.status(400).json({ error: 'Este código já está sendo usado por outra organização.' });
      }
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenant_id },
      data: { name, code: code?.toUpperCase() }
    });
    res.json(tenant);
  } catch (err) {
    console.error('SERVER ERROR [PATCH /api/tenant/info]:', err);
    res.status(500).json({ error: 'Falha ao atualizar informações da organização' });
  }
});

/**
 * Lista Cards do Kanban com filtros (busca, data, criticidade, etc)
 */
app.get('/api/kanban/cards', authenticate, async (req: AuthRequest, res) => {
  try {
    const { search, from, to, criticidade, statusId, tag, integracao } = req.query;
    const where: any = { tenant_id: req.user!.tenant_id, archived_at: null };
    const andConditions: any[] = [];

    // Filtro de Busca Textual (Título, Thread ID, Source, Owner, Assigned User)
    if (search && search !== '') {
      andConditions.push({
        OR: [
          { title: { contains: String(search), mode: 'insensitive' } },
          { alertops_alert: { alertops_thread_id: { contains: String(search), mode: 'insensitive' } } },
          { alertops_alert: { source_identifier: { contains: String(search), mode: 'insensitive' } } },
          { owner_name: { contains: String(search), mode: 'insensitive' } },
          { assigned_user: { name: { contains: String(search), mode: 'insensitive' } } }
        ]
      });
    }

    if (from || to) {
      const dateCondition: any = {};
      if (from) dateCondition.gte = new Date(String(from));
      if (to) dateCondition.lte = new Date(String(to));
      andConditions.push({ created_at: dateCondition });
    }

    if (criticidade && criticidade !== '') {
      andConditions.push({ criticidade: String(criticidade) });
    }

    if (statusId && statusId !== '' && statusId !== 'all') {
      andConditions.push({ status_id: String(statusId) });
    }

    if (tag && tag !== '') {
      andConditions.push({ labels: { some: { name: { contains: String(tag), mode: 'insensitive' } } } });
    }

    if (integracao && integracao !== '' && integracao !== 'all') {
      andConditions.push({ alertops_alert: { integration_name: String(integracao) } });
    }

    if (andConditions.length > 0) where.AND = andConditions;

    const cards = await prisma.card.findMany({
      where,
      include: { 
        status: true, 
        alertops_alert: true,
        labels: true,
        group: true,
        assigned_user: { select: { id: true, name: true, email: true } },
        _count: { select: { checklists: true, comments: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 200
    });
    
    // Calcula progresso de checklist para cada card
    const cardsWithChecklistInfo = await Promise.all(cards.map(async (card) => {
      const doneCount = await prisma.cardChecklist.count({
        where: { card_id: card.id, is_done: true }
      });
      return { ...card, checklist_done_count: doneCount };
    }));

    res.json(cardsWithChecklistInfo);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao carregar cards' });
  }
});

/**
 * Lista Status (Colunas) do Kanban
 */
app.get('/api/kanban/statuses', authenticate, async (req: AuthRequest, res) => {
  try {
    const statuses = await prisma.cardStatus.findMany({
      where: { tenant_id: req.user!.tenant_id },
      orderBy: { position: 'asc' }
    });
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao carregar status' });
  }
});

/**
 * Cria novo Status (Apenas ADMIN)
 */
app.post('/api/kanban/statuses', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { name, color, position, is_initial, is_final } = req.body;
  try {
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
    const status = await prisma.cardStatus.create({
      data: {
        name, slug, color: color || '#64748b', position: position || 99,
        is_initial: is_initial || false, is_final: is_final || false,
        tenant_id: req.user!.tenant_id
      }
    });
    res.status(201).json(status);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao criar status' });
  }
});

/**
 * Atualiza Status (Apenas ADMIN)
 */
app.patch('/api/kanban/statuses/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, color, position, is_initial, is_final } = req.body;
  try {
    const status = await prisma.cardStatus.update({
      where: { id, tenant_id: req.user!.tenant_id },
      data: { name, color, position, is_initial, is_final }
    });
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Falha ao atualizar status' });
  }
});

/**
 * Exclui Status (Apenas ADMIN - Bloqueia se houver cards)
 */
app.delete('/api/kanban/statuses/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const cardsCount = await prisma.card.count({
      where: { status_id: id, tenant_id: req.user!.tenant_id }
    });
    if (cardsCount > 0) {
      return res.status(400).json({ error: 'Não é possível excluir um status que possui cards vinculados.' });
    }
    await prisma.cardStatus.delete({
      where: { id, tenant_id: req.user!.tenant_id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao excluir status' });
  }
});

/**
 * Reordena as colunas do Kanban
 */
app.post('/api/kanban/statuses/reorder', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
  const { order } = req.body;
  try {
    const updates = order.map((item: { id: string, position: number }) => 
      prisma.cardStatus.update({
        where: { id: item.id, tenant_id: req.user!.tenant_id },
        data: { position: item.position }
      })
    );
    await prisma.$transaction(updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao reordenar status' });
  }
});

/**
 * Lista nomes das integrações disponíveis (AlertOps)
 */
app.get('/api/alertops/integrations', authenticate, async (req: AuthRequest, res) => {
  try {
    const integrations = await prisma.alertopsAlert.findMany({
      where: { integration_name: { not: null } },
      select: { integration_name: true },
      distinct: ['integration_name'],
    });
    const list = integrations.map(i => i.integration_name).filter(Boolean).sort();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar integrações' });
  }
});

/**
 * Detalhes de um Card específico
 */
app.get('/api/kanban/cards/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const card = await prisma.card.findFirst({
      where: {
        tenant_id: req.user!.tenant_id,
        OR: [{ id }, { alertops_alert: { alertops_thread_id: id } }]
      },
      include: {
        assigned_user: { select: { id: true, name: true, email: true } },
        status: true, labels: true, alertops_alert: true, group: true
      }
    });
    if (!card) return res.status(404).json({ error: 'Card não encontrado' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar card' });
  }
});

/**
 * Histórico de um Card (Eventos Internos + Eventos AlertOps)
 */
app.get('/api/kanban/cards/:id/history', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card || card.tenant_id !== req.user!.tenant_id) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }

    const internalHistory = await prisma.cardHistory.findMany({
      where: { card_id: id },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });

    const formattedInternal = internalHistory.map(h => ({
      id: h.id, type: 'INTERNAL', action: h.action, user: h.user?.name || 'Sistema',
      old_value: h.old_value, new_value: h.new_value, created_at: h.created_at
    }));

    // Busca eventos brutos da tabela alertops se houver thread_id
    let externalHistory: any[] = [];
    if (card.alertops_thread_id) {
      try {
        const externalEvents: any[] = await prisma.$queryRawUnsafe(`
          SELECT * FROM "tclog_alertops"."alert_events" 
          WHERE "message_thread_id" = $1
          ORDER BY "created_date_local" DESC
        `, card.alertops_thread_id);
        externalHistory = externalHistory = externalEvents.map((e, idx) => ({
          id: `external-${idx}`, type: 'EXTERNAL', action: 'ALERTOPS_SYNC',
          status: e.message_thread_status_type, note: e.last_added_note,
          owner: e.owner_name, resolution: e.resolution,
          created_at: e.created_date_local ? new Date(e.created_date_local) : new Date()
        }));
      } catch (err) {}
    }

    const combined = [...formattedInternal, ...externalHistory].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar histórico' });
  }
});

/**
 * Altera o status (coluna) de um card e registra no histórico
 */
app.patch('/api/kanban/cards/:id/status', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status_id } = req.body;
  try {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card || card.tenant_id !== req.user!.tenant_id) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }
    const oldStatus = await prisma.cardStatus.findUnique({ where: { id: card.status_id } });
    const newStatus = await prisma.cardStatus.findUnique({ where: { id: status_id } });

    await prisma.card.update({ where: { id }, data: { status_id, updated_at: new Date() } });
    await prisma.cardHistory.create({
      data: {
        card_id: id, user_id: req.user!.id, action: 'STATUS_CHANGE', field_name: 'status_id',
        old_value: oldStatus?.name, new_value: newStatus?.name
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao mover card' });
  }
});

/**
 * Atribui ou remove usuário responsável por um card
 */
app.patch('/api/kanban/cards/:id/assign', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  try {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card || card.tenant_id !== req.user!.tenant_id) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }
    const oldAssigneeId = card.assigned_user_id;
    await prisma.card.update({ where: { id }, data: { assigned_user_id: user_id || null, updated_at: new Date() } });
    await prisma.cardHistory.create({
      data: {
        card_id: id, user_id: req.user!.id, action: 'ASSIGNEE_CHANGE', field_name: 'assigned_user_id',
        old_value: oldAssigneeId, new_value: user_id || 'unassigned'
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atribuir usuário' });
  }
});

// COMMENTS

/**
 * Lista comentários de um card
 */
app.get('/api/kanban/cards/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const comments = await prisma.cardComment.findMany({
      where: { card_id: req.params.id },
      include: { user: { select: { name: true } } },
      orderBy: { created_at: 'desc' }
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar comentários' });
  }
});

/**
 * Adiciona comentário em um card com suporte a @menções
 */
app.post('/api/kanban/cards/:id/comments', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { comment, attachments } = req.body;
  try {
    const newComment = await prisma.cardComment.create({
      data: { card_id: id, user_id: req.user!.id, comment, attachments: attachments || [] },
      include: { user: { select: { name: true } } }
    });
    const card = await prisma.card.findUnique({ where: { id } });
    
    // Processamento de Menções (@usuario ou @todos)
    const mentionIds = new Set<string>();
    if (/@todos/i.test(comment) || comment.includes('data-id="todos"')) {
      const allUsers = await prisma.user.findMany({ 
        where: { tenant_id: req.user!.tenant_id, id: { not: req.user!.id } }, select: { id: true }
      });
      allUsers.forEach(u => mentionIds.add(u.id));
    }
    const mentionRegex = /data-id="([^"]+)"/g;
    let match;
    while ((match = mentionRegex.exec(comment)) !== null) {
      if (match[1] !== 'todos' && match[1] !== req.user!.id) mentionIds.add(match[1]);
    }

    if (mentionIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(mentionIds).map(userId => ({
          user_id: userId, title: 'Nova menção',
          message: `${req.user!.name} mencionou você em "${card?.title || 'um card'}"`,
          link: `/dashboard/kanban?cardId=${id}`
        }))
      });
    }

    await prisma.cardHistory.create({
      data: { card_id: id, user_id: req.user!.id, action: 'COMMENT_ADDED', new_value: comment }
    });
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
});

/**
 * Atualiza um comentário (Apenas autor ou ADMIN)
 */
app.patch('/api/kanban/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.cardComment.findUnique({ where: { id: req.params.commentId } });
    if (!existing) return res.status(404).json({ error: 'Comentário não encontrado' });
    if (existing.user_id !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Não autorizado' });
    const updated = await prisma.cardComment.update({
      where: { id: req.params.commentId },
      data: { comment: req.body.comment, attachments: req.body.attachments || existing.attachments, updated_at: new Date() },
      include: { user: { select: { name: true } } }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar comentário' });
  }
});

/**
 * Exclui um comentário (Apenas autor ou ADMIN)
 */
app.delete('/api/kanban/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.cardComment.findUnique({ where: { id: req.params.commentId } });
    if (!existing) return res.status(404).json({ error: 'Comentário não encontrado' });
    if (existing.user_id !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Não autorizado' });
    await prisma.cardComment.delete({ where: { id: req.params.commentId } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir comentário' });
  }
});

// NOTIFICATIONS

/**
 * Lista notificações do usuário logado
 */
app.get('/api/notifications', authenticate, async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user!.id },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar notificações' });
  }
});

/**
 * Marca uma notificação como lida
 */
app.patch('/api/notifications/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id, user_id: req.user!.id }, data: { is_read: true }
    });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler notificação' });
  }
});

// CHECKLISTS

/**
 * Lista itens de checklist de um card
 */
app.get('/api/kanban/cards/:id/checklist', authenticate, async (req: AuthRequest, res) => {
  try {
    const items = await prisma.cardChecklist.findMany({
      where: { card_id: req.params.id }, orderBy: { position: 'asc' }
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar checklist' });
  }
});

/**
 * Adiciona item ao checklist de um card
 */
app.post('/api/kanban/cards/:id/checklist', authenticate, async (req: AuthRequest, res) => {
  try {
    const newItem = await prisma.cardChecklist.create({
      data: { card_id: req.params.id, title: req.body.title }
    });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar item' });
  }
});

/**
 * Atualiza item do checklist (título ou status concluído)
 */
app.patch('/api/kanban/checklist/:itemId', authenticate, async (req: AuthRequest, res) => {
  try {
    const updated = await prisma.cardChecklist.update({
      where: { id: req.params.itemId }, data: { is_done: req.body.is_done, title: req.body.title }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

/**
 * Exclui item do checklist
 */
app.delete('/api/kanban/checklist/:itemId', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.cardChecklist.delete({ where: { id: req.params.itemId } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir item' });
  }
});

// LABELS

/**
 * Adiciona etiqueta (label) em um card
 */
app.post('/api/kanban/cards/:id/labels', authenticate, async (req: AuthRequest, res) => {
  try {
    const label = await prisma.cardLabel.create({
      data: { card_id: req.params.id, name: req.body.name, color: req.body.color }
    });
    res.status(201).json(label);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar etiqueta' });
  }
});

/**
 * Remove etiqueta de um card
 */
app.delete('/api/kanban/labels/:labelId', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.cardLabel.delete({ where: { id: req.params.labelId } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir etiqueta' });
  }
});

// GROUPS

/**
 * Lista grupos de alertas (Agrupamento de cards correlacionados)
 */
app.get('/api/kanban/groups', authenticate, async (req: AuthRequest, res) => {
  try {
    const groups = await prisma.alertGroup.findMany({
      where: { tenant_id: req.user!.tenant_id },
      include: { cards: { select: { id: true, title: true, priority: true, criticidade: true, alertops_alert: { select: { alertops_thread_id: true } } } } },
      orderBy: { created_at: 'desc' }
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

/**
 * Cria um novo grupo e associa cards a ele
 */
app.post('/api/kanban/groups', authenticate, async (req: AuthRequest, res) => {
  try {
    const group = await prisma.alertGroup.create({
      data: {
        tenant_id: req.user!.tenant_id, name: req.body.name, description: req.body.description,
        cards: req.body.cardIds ? { connect: req.body.cardIds.map((id: string) => ({ id })) } : undefined
      },
      include: { cards: true }
    });
    if (req.body.cardIds) {
      await prisma.cardHistory.createMany({
        data: req.body.cardIds.map((id: string) => ({
          card_id: id, user_id: req.user!.id, action: 'ADDED_TO_GROUP', new_value: req.body.name
        }))
      });
    }
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar grupo' });
  }
});

/**
 * Remove um grupo (Os cards continuam existindo, apenas perdem o vínculo)
 */
app.delete('/api/kanban/groups/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.card.updateMany({ where: { group_id: req.params.id }, data: { group_id: null } });
    await prisma.alertGroup.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir grupo' });
  }
});

// INTERNAL / SYNC

/**
 * Rota interna para forçar a sincronização de alertas do banco raw (tclog_alertops)
 * Exige INTERNAL_SYNC_TOKEN em produção.
 */
app.post('/api/internal/sync-alertops', async (req, res) => {
  const token = req.headers['x-sync-token'];
  if (token !== process.env.INTERNAL_SYNC_TOKEN && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  const result = await syncAssignedAlertOpsAlerts();
  res.json(result);
});

// METRICS

/**
 * Retorna as métricas principais do Dashboard e dados para gráficos
 */
app.get('/api/dashboard/metrics', authenticate, async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenant_id;
  try {
    const totalAssigned = await prisma.alertopsAlert.count({ where: { status_alertops: 'Assigned' } });
    const openCards = await prisma.card.count({ where: { tenant_id: tenantId, archived_at: null } });
    const overdue = await prisma.card.count({
      where: { tenant_id: tenantId, archived_at: null, due_at: { lt: new Date() }, status: { is_final: false } }
    });
    const resolvedLast24h = await prisma.card.count({
      where: { tenant_id: tenantId, status: { is_final: true }, updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    });

    // Distribuição por Criticidade (Gráfico de Pizza)
    const cards = await prisma.card.findMany({
      where: { tenant_id: tenantId, archived_at: null },
      select: { criticidade: true }
    });

    const criticalityCounts: Record<string, number> = {};
    cards.forEach(c => {
      const raw = c.criticidade || 'INDEFINIDA';
      const norm = raw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      criticalityCounts[norm] = (criticalityCounts[norm] || 0) + 1;
    });

    const criticalityDistribution = Object.entries(criticalityCounts).map(([name, value]) => ({ name, value }));

    // Volume por dia - últimos 7 dias (Gráfico de Barras)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const volumeData = await prisma.card.findMany({
      where: { tenant_id: tenantId, created_at: { gte: sevenDaysAgo } },
      select: { created_at: true }
    });

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const volumeByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      volumeByDay[days[d.getDay()]] = 0;
    }

    volumeData.forEach(v => {
      const day = days[new Date(v.created_at).getDay()];
      if (volumeByDay[day] !== undefined) volumeByDay[day]++;
    });

    const dailyStats = Object.entries(volumeByDay)
      .map(([name, total]) => ({ name, total }))
      .reverse();
    
    res.json({
      totalAssigned, openCards, overdue, resolvedLast24h,
      criticalityDistribution, dailyStats,
      mttr: 18, sla: 94
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar métricas' });
  }
});

// REMINDERS

/**
 * Lista lembretes configurados pelo usuário
 */
app.get('/api/reminders', authenticate, async (req: AuthRequest, res) => {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { user_id: req.user!.id },
      orderBy: { due_at: 'asc' },
      include: { card: { select: { id: true, title: true } }, user: { select: { name: true } } }
    });
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar lembretes' });
  }
});

/**
 * Cria um novo lembrete com agendamento
 */
app.post('/api/reminders', authenticate, async (req: AuthRequest, res) => {
  try {
    const reminder = await prisma.reminder.create({
      data: {
        user_id: req.user!.id, card_id: req.body.card_id || null,
        title: req.body.title, description: req.body.description,
        due_at: new Date(req.body.due_at), mentions: req.body.mentions || []
      }
    });
    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar lembrete' });
  }
});

// VERCEL SPECIFIC: ROUTE FOR CRON REMINDERS

/**
 * Rota para Processamento de Lembretes (Triggered por Vercel Cron)
 * Verifica lembretes vencidos e gera notificações internas.
 */
app.get('/api/internal/process-reminders', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const dueReminders = await prisma.reminder.findMany({
      where: { is_done: false, due_at: { lte: new Date() } },
      include: { user: { select: { id: true, tenant_id: true } } }
    });

    for (const reminder of dueReminders) {
      await prisma.notification.create({
        data: {
          user_id: reminder.user_id,
          title: '⏰ Lembrete Ativo',
          message: reminder.title,
          link: reminder.card_id ? `/dashboard/kanban?cardId=${reminder.card_id}` : undefined
        }
      });
      await prisma.reminder.update({ where: { id: reminder.id }, data: { is_done: true } });
    }
    res.json({ processed: dueReminders.length });
  } catch (err) {
    res.status(500).json({ error: 'Error processing reminders' });
  }
});

export default app;
