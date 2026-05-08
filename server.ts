import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prisma from './src/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateToken, authenticate, AuthRequest, authorize } from './src/lib/auth';
import { syncAssignedAlertOpsAlerts } from './src/services/alertops/alertops-sync.service';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- PUBLIC API ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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
        userRole = 'OPERATOR'; // Users joining via code are Operators by default
      } else {
        const slug = (tenant_name || name).toLowerCase().replace(/[^a-z0-9]/g, '-');
        const tenant = await prisma.tenant.create({
          data: {
            name: tenant_name || `Tenant de ${name}`,
            slug: `${slug}-${Math.random().toString(36).substring(2, 7)}`,
            code: Math.random().toString(36).substring(2, 8).toUpperCase(), // Generate a random code for new tenants
          }
        });
        tenantId = tenant.id;

        // Default card statuses for new tenant
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

  // --- PROTECTED API ---
  app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

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

  app.patch('/api/tenant/info', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    const { name, code } = req.body;
    try {
      // Check if code is being used by another tenant
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
        data: { 
          name, 
          code: code?.toUpperCase() 
        }
      });
      res.json(tenant);
    } catch (err) {
      console.error('SERVER ERROR [PATCH /api/tenant/info]:', err);
      res.status(500).json({ error: 'Falha ao atualizar informações da organização' });
    }
  });

  app.get('/api/kanban/cards', authenticate, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.tenant_id) {
        return res.status(401).json({ error: 'Tenant não identificado' });
      }

      console.log(`[API] GET /api/kanban/cards - User: ${req.user.email}, Tenant: ${req.user.tenant_id}`);
      
      const { search, from, to, criticidade, statusId, tag, integracao } = req.query;
      const where: any = { 
        tenant_id: req.user.tenant_id, 
        archived_at: null 
      };

      const andConditions: any[] = [];

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
        andConditions.push({
          alertops_alert: { integration_name: String(integracao) }
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      console.log('[API] Querying cards with where:', JSON.stringify(where));

      const isFiltered = !!(search || from || to || criticidade || statusId || tag || integracao);
      const limit = isFiltered ? 200 : 100;

      const cards = await prisma.card.findMany({
        where,
        include: { 
          status: true, 
          alertops_alert: true,
          labels: true,
          group: true,
          assigned_user: { select: { id: true, name: true, email: true } },
          _count: {
            select: { checklists: true, comments: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: limit
      });
      
      console.log(`[API] Found ${cards.length} cards.`);
      
      // Simpler loop for counts to avoid any groupBy issues
      const cardsWithChecklistInfo = await Promise.all(cards.map(async (card) => {
        const doneCount = await prisma.cardChecklist.count({
          where: { card_id: card.id, is_done: true }
        });
        return {
          ...card,
          checklist_done_count: doneCount
        };
      }));

      res.json(cardsWithChecklistInfo);
    } catch (error) {
      console.error('SERVER ERROR [GET /api/kanban/cards]:', error);
      const detail = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Erro interno ao carregar cards: ${detail}`, details: detail });
    }
  });

  app.get('/api/kanban/statuses', authenticate, async (req: AuthRequest, res) => {
    try {
      const statuses = await prisma.cardStatus.findMany({
        where: { tenant_id: req.user!.tenant_id },
        orderBy: { position: 'asc' }
      });
      res.json(statuses);
    } catch (error) {
      console.error('SERVER ERROR [GET /api/kanban/statuses]:', error);
      res.status(500).json({ error: 'Falha ao carregar status', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/kanban/statuses', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    const { name, color, position, is_initial, is_final } = req.body;
    try {
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');
      const status = await prisma.cardStatus.create({
        data: {
          name,
          slug,
          color: color || '#64748b',
          position: position || 99,
          is_initial: is_initial || false,
          is_final: is_final || false,
          tenant_id: req.user!.tenant_id
        }
      });
      res.status(201).json(status);
    } catch (error) {
      console.error('SERVER ERROR [POST /api/kanban/statuses]:', error);
      res.status(500).json({ error: 'Falha ao criar status' });
    }
  });

  app.patch('/api/kanban/statuses/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, color, position, is_initial, is_final } = req.body;
    try {
      const status = await prisma.cardStatus.update({
        where: { id, tenant_id: req.user!.tenant_id },
        data: {
          name,
          color,
          position,
          is_initial,
          is_final
        }
      });
      res.json(status);
    } catch (error) {
      console.error('SERVER ERROR [PATCH /api/kanban/statuses/:id]:', error);
      res.status(500).json({ error: 'Falha ao atualizar status' });
    }
  });

  app.delete('/api/kanban/statuses/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      // Check if there are cards using this status
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
      console.error('SERVER ERROR [DELETE /api/kanban/statuses/:id]:', error);
      res.status(500).json({ error: 'Falha ao excluir status' });
    }
  });

  app.post('/api/kanban/statuses/reorder', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    const { order } = req.body; // Array of {id, position}
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
      console.error('SERVER ERROR [POST /api/kanban/statuses/reorder]:', error);
      res.status(500).json({ error: 'Falha ao reordenar status' });
    }
  });

  app.get('/api/alertops/integrations', authenticate, async (req: AuthRequest, res) => {
    try {
      const integrations = await prisma.alertopsAlert.findMany({
        where: { integration_name: { not: null } },
        select: { integration_name: true },
        distinct: ['integration_name'],
      });
      
      const list = Array.from(new Set(
        integrations
          .map(i => i.integration_name)
          .filter((val): val is string => !!val)
      )).sort();
      
      res.json(list);
    } catch (err) {
      console.error('SERVER ERROR [GET /api/alertops/integrations]:', err);
      res.status(500).json({ error: 'Erro ao carregar integrações', details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/kanban/cards/:id', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const card = await prisma.card.findFirst({
        where: {
          tenant_id: req.user!.tenant_id,
          OR: [
            { id },
            { alertops_alert: { alertops_thread_id: id } }
          ]
        },
        include: {
          assigned_user: { select: { id: true, name: true, email: true } },
          status: true,
          labels: true,
          alertops_alert: true,
          group: true
        }
      });
      if (!card) {
        return res.status(404).json({ error: 'Card não encontrado' });
      }
      res.json(card);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar card' });
    }
  });
  
  app.get('/api/kanban/cards/:id/history', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const card = await prisma.card.findUnique({
        where: { id }
      });

      if (!card || card.tenant_id !== req.user!.tenant_id) {
        return res.status(404).json({ error: 'Card não encontrado' });
      }

      // 1. Histórico Interno
      const internalHistory = await prisma.cardHistory.findMany({
        where: { card_id: id },
        include: { user: { select: { name: true } } },
        orderBy: { created_at: 'desc' }
      });

      const formattedInternal = internalHistory.map(h => ({
        id: h.id,
        type: 'INTERNAL',
        action: h.action,
        user: h.user?.name || 'Sistema',
        old_value: h.old_value,
        new_value: h.new_value,
        created_at: h.created_at
      }));

      // 2. Histórico Externo (AlertOps Evolution)
      let externalHistory: any[] = [];
      if (card.alertops_thread_id) {
        try {
          const externalEvents: any[] = await prisma.$queryRawUnsafe(`
            SELECT * FROM "tclog_alertops"."alert_events" 
            WHERE "message_thread_id" = $1
            ORDER BY "created_date_local" DESC
          `, card.alertops_thread_id);

          externalHistory = externalEvents.map((e, idx) => ({
            id: `external-${idx}`,
            type: 'EXTERNAL',
            action: 'ALERTOPS_SYNC',
            status: e.message_thread_status_type,
            note: e.last_added_note,
            owner: e.owner_name,
            resolution: e.resolution,
            created_at: e.created_date_local ? new Date(e.created_date_local) : new Date(),
            raw: e
          }));
        } catch (err) {
          console.error('Erro ao buscar histórico externo:', err);
        }
      }

      // Combinar e ordenar por data decrescente
      const combined = [...formattedInternal, ...externalHistory].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      res.json(combined);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao carregar histórico' });
    }
  });

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

      await prisma.card.update({
        where: { id },
        data: { status_id, updated_at: new Date() }
      });

      await prisma.cardHistory.create({
        data: {
          card_id: id,
          user_id: req.user!.id,
          action: 'STATUS_CHANGE',
          field_name: 'status_id',
          old_value: oldStatus?.name,
          new_value: newStatus?.name
        }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao mover card' });
    }
  });

  app.patch('/api/kanban/cards/:id/assign', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    try {
      const card = await prisma.card.findUnique({ where: { id } });
      if (!card || card.tenant_id !== req.user!.tenant_id) {
        return res.status(404).json({ error: 'Card não encontrado' });
      }

      const oldAssigneeId = card.assigned_user_id;

      await prisma.card.update({
        where: { id },
        data: { assigned_user_id: user_id || null, updated_at: new Date() }
      });

      await prisma.cardHistory.create({
        data: {
          card_id: id,
          user_id: req.user!.id,
          action: 'ASSIGNEE_CHANGE',
          field_name: 'assigned_user_id',
          old_value: oldAssigneeId,
          new_value: user_id || 'unassigned'
        }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atribuir usuário' });
    }
  });

  // CARD COMMENTS
  app.get('/api/kanban/cards/:id/comments', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const comments = await prisma.cardComment.findMany({
        where: { card_id: id },
        include: { user: { select: { name: true } } },
        orderBy: { created_at: 'desc' }
      });
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar comentários' });
    }
  });

  app.post('/api/kanban/cards/:id/comments', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { comment, attachments } = req.body;
    try {
      const newComment = await prisma.cardComment.create({
        data: {
          card_id: id,
          user_id: req.user!.id,
          comment,
          attachments: attachments || []
        },
        include: { user: { select: { name: true } } }
      });

      // Logic for mentions - Improved for Quill HTML structure
      const currentUserName = req.user!.name;
      const card = await prisma.card.findUnique({ where: { id } });
      const mentionIds = new Set<string>();

      // 1. Check for @todos
      if (/@todos/i.test(comment) || comment.includes('data-id="todos"')) {
        const allUsers = await prisma.user.findMany({ 
          where: { tenant_id: req.user!.tenant_id, id: { not: req.user!.id } },
          select: { id: true }
        });
        allUsers.forEach(u => mentionIds.add(u.id));
      }

      // 2. Extract specific mentions from data-id attributes (Quill standard)
      const mentionRegex = /data-id="([^"]+)"/g;
      let match;
      while ((match = mentionRegex.exec(comment)) !== null) {
        const userId = match[1];
        if (userId !== 'todos' && userId !== req.user!.id) {
          mentionIds.add(userId);
        }
      }

      // 3. Create notifications for all identified users
      if (mentionIds.size > 0) {
        await prisma.notification.createMany({
          data: Array.from(mentionIds).map(userId => ({
            user_id: userId,
            title: 'Nova menção',
            message: `${currentUserName} mencionou você em "${card?.title || 'um card'}"`,
            link: `/dashboard/kanban?cardId=${id}`
          }))
        });
      }

      // Registrar no histórico
      await prisma.cardHistory.create({
        data: {
          card_id: id,
          user_id: req.user!.id,
          action: 'COMMENT_ADDED',
          new_value: comment
        }
      });

      res.status(201).json(newComment);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao adicionar comentário' });
    }
  });

  app.patch('/api/kanban/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
    const { commentId } = req.params;
    const { comment, attachments } = req.body;
    try {
      const existing = await prisma.cardComment.findUnique({ where: { id: commentId } });
      if (!existing) {
        return res.status(404).json({ error: 'Comentário não encontrado' });
      }

      // Admin pode editar qualquer um, User apenas os seus
      if (existing.user_id !== req.user!.id && req.user!.role !== 'ADMIN') {
         return res.status(403).json({ error: 'Não autorizado' });
      }

      const updated = await prisma.cardComment.update({
        where: { id: commentId },
        data: { 
          comment, 
          attachments: attachments || existing.attachments,
          updated_at: new Date() 
        },
        include: { user: { select: { name: true } } }
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar comentário' });
    }
  });

  app.delete('/api/kanban/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
    const { commentId } = req.params;
    try {
      const existing = await prisma.cardComment.findUnique({ where: { id: commentId } });
      if (!existing) {
        return res.status(404).json({ error: 'Comentário não encontrado' });
      }

      // Admin pode deletar qualquer um, User apenas os seus
      if (existing.user_id !== req.user!.id && req.user!.role !== 'ADMIN') {
         return res.status(403).json({ error: 'Não autorizado' });
      }

      await prisma.cardComment.delete({ where: { id: commentId } });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao excluir comentário' });
    }
  });

  app.get('/api/notifications', authenticate, async (req: AuthRequest, res) => {
    try {
      const { search, from, to } = req.query;
      const where: any = { user_id: req.user!.id };

      if (search) {
        where.OR = [
          { title: { contains: String(search), mode: 'insensitive' } },
          { message: { contains: String(search), mode: 'insensitive' } }
        ];
      }

      if (from || to) {
        where.created_at = {};
        if (from) where.created_at.gte = new Date(String(from));
        if (to) where.created_at.lte = new Date(String(to));
      }

      const isFiltered = !!(search || from || to);
      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: isFiltered ? 100 : 50
      });
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar notificações' });
    }
  });

  app.patch('/api/notifications/:id/read', authenticate, async (req: AuthRequest, res) => {
    try {
      await prisma.notification.update({
        where: { id: req.params.id, user_id: req.user!.id },
        data: { is_read: true }
      });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao ler notificação' });
    }
  });

  app.patch('/api/notifications/read-all', authenticate, async (req: AuthRequest, res) => {
    try {
      await prisma.notification.updateMany({
        where: { user_id: req.user!.id, is_read: false },
        data: { is_read: true }
      });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao ler notificações' });
    }
  });

  // CHECKLISTS
  app.get('/api/kanban/cards/:id/checklist', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const items = await prisma.cardChecklist.findMany({
        where: { card_id: id },
        orderBy: { position: 'asc' }
      });
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar checklist' });
    }
  });

  app.post('/api/kanban/cards/:id/checklist', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { title } = req.body;
    try {
      const newItem = await prisma.cardChecklist.create({
        data: { card_id: id, title }
      });
      res.status(201).json(newItem);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao adicionar item' });
    }
  });

  app.patch('/api/kanban/checklist/:itemId', authenticate, async (req: AuthRequest, res) => {
    const { itemId } = req.params;
    const { is_done, title } = req.body;
    try {
      const updated = await prisma.cardChecklist.update({
        where: { id: itemId },
        data: { is_done, title }
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar item' });
    }
  });

  app.delete('/api/kanban/checklist/:itemId', authenticate, async (req: AuthRequest, res) => {
    const { itemId } = req.params;
    try {
      await prisma.cardChecklist.delete({ where: { id: itemId } });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao excluir item' });
    }
  });

  // LABELS
  app.post('/api/kanban/cards/:id/labels', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { name, color } = req.body;
    try {
      const label = await prisma.cardLabel.create({
        data: { card_id: id, name, color }
      });
      res.status(201).json(label);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao adicionar etiqueta' });
    }
  });

  app.delete('/api/kanban/labels/:labelId', authenticate, async (req: AuthRequest, res) => {
    const { labelId } = req.params;
    try {
      await prisma.cardLabel.delete({ where: { id: labelId } });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao excluir etiqueta' });
    }
  });

  // ALERT GROUPS
  app.get('/api/kanban/groups', authenticate, async (req: AuthRequest, res) => {
    try {
      const groups = await prisma.alertGroup.findMany({
        where: { tenant_id: req.user!.tenant_id },
        include: {
          cards: {
            select: { 
              id: true, 
              title: true, 
              priority: true, 
              criticidade: true,
              alertops_alert: { select: { alertops_thread_id: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      res.json(groups);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao listar grupos' });
    }
  });

  app.post('/api/kanban/groups', authenticate, async (req: AuthRequest, res) => {
    const { name, description, cardIds } = req.body;
    try {
      const group = await prisma.alertGroup.create({
        data: {
          tenant_id: req.user!.tenant_id,
          name,
          description,
          cards: cardIds ? {
            connect: cardIds.map((id: string) => ({ id }))
          } : undefined
        },
        include: { cards: true }
      });

      if (cardIds && cardIds.length > 0) {
        await prisma.cardHistory.createMany({
          data: cardIds.map((id: string) => ({
            card_id: id,
            user_id: req.user!.id,
            action: 'ADDED_TO_GROUP',
            new_value: name
          }))
        });
      }

      res.json(group);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar grupo' });
    }
  });

  app.post('/api/kanban/groups/:id/add-cards', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { cardIds } = req.body;
    try {
      const group = await prisma.alertGroup.update({
        where: { id },
        data: {
          cards: {
            connect: cardIds.map((cid: string) => ({ id: cid }))
          }
        },
        include: { cards: true }
      });

      await prisma.cardHistory.createMany({
        data: cardIds.map((cid: string) => ({
          card_id: cid,
          user_id: req.user!.id,
          action: 'ADDED_TO_GROUP',
          new_value: group.name
        }))
      });

      res.json(group);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao adicionar cards ao grupo' });
    }
  });

  app.post('/api/kanban/groups/:id/remove-cards', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { cardIds } = req.body;
    try {
      await prisma.alertGroup.update({
        where: { id },
        data: {
          cards: {
            disconnect: cardIds.map((cid: string) => ({ id: cid }))
          }
        }
      });

      await prisma.cardHistory.createMany({
        data: cardIds.map((cid: string) => ({
          card_id: cid,
          user_id: req.user!.id,
          action: 'REMOVED_FROM_GROUP'
        }))
      });

      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao remover cards do grupo' });
    }
  });

  app.delete('/api/kanban/groups/:id', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      // First detach all cards from this group
      await prisma.card.updateMany({
        where: { group_id: id },
        data: { group_id: null }
      });
      
      // Then delete the group
      await prisma.alertGroup.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      console.error('SERVER ERROR [DELETE /api/kanban/groups/:id]:', err);
      res.status(500).json({ error: 'Erro ao excluir grupo' });
    }
  });

  // SYNC
  app.post('/api/internal/sync-alertops', async (req, res) => {
    const token = req.headers['x-sync-token'];
    if (token !== process.env.INTERNAL_SYNC_TOKEN && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Não foi possível sincronizar: token interno ausente ou inválido.' });
    }
    const result = await syncAssignedAlertOpsAlerts();
    res.json(result);
  });

  // DASHBOARD METRICS
  app.get('/api/dashboard/metrics', authenticate, async (req: AuthRequest, res) => {
    const tenantId = req.user!.tenant_id;
    const totalAssigned = await prisma.alertopsAlert.count({ where: { status_alertops: 'Assigned' } });
    const openCards = await prisma.card.count({ where: { tenant_id: tenantId, archived_at: null } });
    const overdue = await prisma.card.count({
      where: { 
        tenant_id: tenantId, 
        archived_at: null,
        due_at: { lt: new Date() },
        status: { is_final: false }
      }
    });

    const resolvedLast24h = await prisma.card.count({
      where: {
        tenant_id: tenantId,
        status: { is_final: true },
        updated_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    // Criticidade
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

    // Volume por dia (últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const volumeData = await prisma.card.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: sevenDaysAgo }
      },
      select: { created_at: true }
    });

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const volumeByDay: Record<string, number> = {};
    
    // Iniciar com 0 para todos os últimos 7 dias
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      volumeByDay[days[d.getDay()]] = 0;
    }

    volumeData.forEach(v => {
      const day = days[new Date(v.created_at).getDay()];
      if (volumeByDay[day] !== undefined) {
        volumeByDay[day]++;
      }
    });

    const dailyStats = Object.entries(volumeByDay)
      .map(([name, total]) => ({ name, total }))
      .reverse(); // Ordem cronológica aproximada
    
    res.json({
      totalAssigned,
      openCards,
      overdue,
      resolvedLast24h,
      criticalityDistribution,
      dailyStats,
      mttr: 18, // Mocked 18 minutes as requested
      sla: 94   // Mocked 94% as requested
    });
  });

  // REMINDERS
  app.get('/api/reminders', authenticate, async (req: AuthRequest, res) => {
    try {
      const { card_id } = req.query;
      
      let where: any = {
        OR: [
          { user_id: req.user!.id },
          { mentions: { array_contains: req.user!.id } },
          { mentions: { array_contains: 'todos' } }
        ]
      };

      if (card_id) {
        where = { 
          card_id: String(card_id),
          OR: [
            { user_id: req.user!.id },
            { mentions: { array_contains: req.user!.id } },
            { mentions: { array_contains: 'todos' } }
          ]
        };
      }
      
      const reminders = await prisma.reminder.findMany({
        where,
        orderBy: { due_at: 'asc' },
        include: {
          card: {
            select: {
              id: true,
              title: true,
              alertops_alert: {
                select: { alertops_thread_id: true }
              }
            }
          },
          user: {
            select: { name: true }
          }
        }
      });
      res.json(reminders);
    } catch (err) {
      console.error('Erro ao carregar lembretes:', err);
      res.status(500).json({ error: 'Erro ao carregar lembretes' });
    }
  });

  app.post('/api/reminders', authenticate, async (req: AuthRequest, res) => {
    const { card_id, title, description, due_at, mentions } = req.body;
    try {
      const reminder = await prisma.reminder.create({
        data: {
          user_id: req.user!.id,
          card_id: card_id || null,
          title,
          description,
          due_at: new Date(due_at),
          mentions: mentions || []
        }
      });
      res.status(201).json(reminder);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao criar lembrete' });
    }
  });

  app.patch('/api/reminders/:id', authenticate, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { is_done, title, description, due_at, mentions } = req.body;
    try {
      const updated = await prisma.reminder.update({
        where: { id, user_id: req.user!.id },
        data: { 
          is_done, 
          title, 
          description, 
          due_at: due_at ? new Date(due_at) : undefined,
          mentions 
        }
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar lembrete' });
    }
  });

  app.delete('/api/reminders/:id', authenticate, async (req: AuthRequest, res) => {
    try {
      await prisma.reminder.delete({
        where: { id: req.params.id, user_id: req.user!.id }
      });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: 'Erro ao excluir lembrete' });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // REMINDER CHECKER (every minute)
  setInterval(async () => {
    try {
      // Garantir que o prisma está conectado
      await prisma.$connect().catch(() => {});

      const dueReminders = await prisma.reminder.findMany({
        where: {
          is_done: false,
          due_at: { lte: new Date() }
        },
        include: { 
          card: { select: { id: true, title: true } },
          user: { select: { id: true, tenant_id: true } }
        }
      });

      if (dueReminders.length === 0) return;

      console.log(`[Reminder] Processando ${dueReminders.length} lembretes pendentes...`);

      for (const reminder of dueReminders) {
        try {
          const usersToNotify = new Set<string>();
          usersToNotify.add(reminder.user_id);

          // Process Mentions
          if (reminder.mentions && Array.isArray(reminder.mentions)) {
            const mentions = reminder.mentions as string[];
            if (mentions.includes('todos')) {
              const allUsers = await prisma.user.findMany({
                where: { tenant_id: reminder.user.tenant_id },
                select: { id: true }
              });
              allUsers.forEach(u => usersToNotify.add(u.id));
            } else {
              mentions.forEach(uid => {
                if (uid && typeof uid === 'string') usersToNotify.add(uid);
              });
            }
          }

          // Criar notificações
          await prisma.notification.createMany({
            data: Array.from(usersToNotify).map(userId => ({
              user_id: userId,
              title: '⏰ Lembrete Ativo',
              message: reminder.title,
              link: reminder.card_id ? `/dashboard/kanban?cardId=${reminder.card_id}` : undefined
            }))
          });

          // Marcar como concluído
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { is_done: true, updated_at: new Date() }
          });
          
          console.log(`[Reminder] Sucesso: "${reminder.title}" enviado para ${usersToNotify.size} usuários.`);
        } catch (err: any) {
          console.error(`[Reminder] Erro ao processar lembrete ${reminder.id}:`, err.message || err);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('terminating connection') || err.code === 'P2024') {
        console.warn('[Reminder] Conexão interrompida durante a verificação.');
      } else {
        console.error('[Reminder] Erro crítico na verificação de lembretes:', err);
      }
    }
  }, 60 * 1000);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
