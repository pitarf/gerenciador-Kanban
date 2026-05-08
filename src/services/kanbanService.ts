import { Card, CardStatus } from '../types';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

export const kanbanService = {
  getCards: async (filters?: { 
    search?: string, 
    from?: string, 
    to?: string,
    criticidade?: string,
    statusId?: string,
    tag?: string,
    integracao?: string
  }): Promise<Card[]> => {
    let url = '/api/kanban/cards';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.criticidade) params.append('criticidade', filters.criticidade);
      if (filters.statusId) params.append('statusId', filters.statusId);
      if (filters.tag) params.append('tag', filters.tag);
      if (filters.integracao) params.append('integracao', filters.integracao);
      const query = params.toString();
      if (query) url += `?${query}`;
    }
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || 'Falha ao carregar cards');
    }
    return res.json();
  },

  getCard: async (id: string): Promise<Card> => {
    const res = await fetch(`/api/kanban/cards/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar card');
    return res.json();
  },

  getStatuses: async (): Promise<CardStatus[]> => {
    const res = await fetch('/api/kanban/statuses', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar status');
    return res.json();
  },

  getIntegrations: async (): Promise<string[]> => {
    const res = await fetch('/api/alertops/integrations', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar integrações');
    return res.json();
  },

  updateCardStatus: async (cardId: string, statusId: string): Promise<void> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status_id: statusId })
    });
    if (!res.ok) throw new Error('Falha ao mover card');
  },
  
  assignCard: async (cardId: string, userId: string | null): Promise<void> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/assign`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ user_id: userId })
    });
    if (!res.ok) throw new Error('Falha ao atribuir usuário');
  },

  getComments: async (cardId: string): Promise<any[]> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/comments`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar comentários');
    return res.json();
  },

  addComment: async (card_id: string, comment: string, attachments?: any[]): Promise<any> => {
    const res = await fetch(`/api/kanban/cards/${card_id}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ comment, attachments })
    });
    if (!res.ok) throw new Error('Falha ao adicionar comentário');
    return res.json();
  },

  updateComment: async (commentId: string, comment: string, attachments?: any[]): Promise<any> => {
    const res = await fetch(`/api/kanban/comments/${commentId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ comment, attachments })
    });
    if (!res.ok) throw new Error('Falha ao atualizar comentário');
    return res.json();
  },

  deleteComment: async (commentId: string): Promise<void> => {
    const res = await fetch(`/api/kanban/comments/${commentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao excluir comentário');
  },

  getUsers: async (): Promise<any[]> => {
    const res = await fetch('/api/users', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar usuários');
    return res.json();
  },

  getNotifications: async (filters?: { search?: string, from?: string, to?: string }): Promise<any[]> => {
    let url = '/api/notifications';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      const query = params.toString();
      if (query) url += `?${query}`;
    }
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar notificações');
    return res.json();
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao ler notificação');
  },

  markAllNotificationsAsRead: async (): Promise<void> => {
    const res = await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao ler notificações');
  },

  getChecklist: async (cardId: string): Promise<any[]> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/checklist`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar checklist');
    return res.json();
  },

  addChecklistItem: async (cardId: string, title: string): Promise<any> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/checklist`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Falha ao adicionar item no checklist');
    return res.json();
  },

  updateChecklistItem: async (itemId: string, data: { is_done?: boolean, title?: string }): Promise<any> => {
    const res = await fetch(`/api/kanban/checklist/${itemId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar item');
    return res.json();
  },

  deleteChecklistItem: async (itemId: string): Promise<void> => {
    const res = await fetch(`/api/kanban/checklist/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao excluir item');
  },

  addLabel: async (cardId: string, name: string, color: string): Promise<any> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/labels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, color })
    });
    if (!res.ok) throw new Error('Falha ao adicionar etiqueta');
    return res.json();
  },

  deleteLabel: async (labelId: string): Promise<void> => {
    const res = await fetch(`/api/kanban/labels/${labelId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao excluir etiqueta');
  },

  getHistory: async (cardId: string): Promise<any[]> => {
    const res = await fetch(`/api/kanban/cards/${cardId}/history`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar histórico');
    return res.json();
  },
  
  getGroups: async (): Promise<any[]> => {
    const res = await fetch('/api/kanban/groups', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar grupos');
    return res.json();
  },

  createGroup: async (data: { name: string, description?: string, cardIds?: string[] }): Promise<any> => {
    const res = await fetch('/api/kanban/groups', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao criar grupo');
    return res.json();
  },

  addCardsToGroup: async (groupId: string, cardIds: string[]): Promise<any> => {
    const res = await fetch(`/api/kanban/groups/${groupId}/add-cards`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cardIds })
    });
    if (!res.ok) throw new Error('Falha ao adicionar cards ao grupo');
    return res.json();
  },

  removeCardsFromGroup: async (groupId: string, cardIds: string[]): Promise<void> => {
    const res = await fetch(`/api/kanban/groups/${groupId}/remove-cards`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cardIds })
    });
    if (!res.ok) throw new Error('Falha ao remover cards do grupo');
  },

  deleteGroup: async (groupId: string): Promise<void> => {
    const res = await fetch(`/api/kanban/groups/${groupId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao excluir grupo');
  }
};
