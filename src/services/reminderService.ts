const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

const apiFetch = async (endpoint: string, options: any = {}) => {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || 'Erro na requisição');
  }
  if (response.status === 204) return null;
  return response.json();
};

export const reminderService = {
  getReminders: async (cardId?: string) => {
    const query = cardId ? `?card_id=${cardId}` : '';
    return apiFetch(`/reminders${query}`);
  },

  createReminder: async (data: { 
    card_id?: string; 
    title: string; 
    description?: string; 
    due_at: string | Date;
    mentions?: string[];
  }) => {
    return apiFetch('/reminders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateReminder: async (id: string, data: { 
    is_done?: boolean; 
    title?: string; 
    description?: string; 
    due_at?: string | Date;
    mentions?: string[];
  }) => {
    return apiFetch(`/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  deleteReminder: async (id: string) => {
    return apiFetch(`/reminders/${id}`, {
      method: 'DELETE'
    });
  }
};
