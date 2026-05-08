export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  tenant_id: string;
}

export interface CardStatus {
  id: string;
  name: string;
  slug: string;
  color: string;
  position: number;
  is_initial: boolean;
  is_final: boolean;
}

export interface AlertopsAlert {
  id: string;
  alertops_thread_id: string;
  source_identifier?: string;
  integration_name?: string;
  status_alertops?: string;
  title?: string;
  message_text?: string;
  description?: string;
  topic?: string;
  criticidade?: string;
  owner_name?: string;
  owner_username?: string;
  last_note?: string;
  resolution_note?: string;
  source_url?: string;
  alert_created_at?: string;
  alert_updated_at?: string;
  alert_closed_at?: string;
  sla_deadline_at?: string;
  json_operacao?: any;
}

export interface AlertGroup {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  created_at: string;
  cards?: Partial<Card>[];
}

export interface Card {
  id: string;
  title: string;
  message_text?: string;
  description?: string;
  status_id: string;
  status: CardStatus;
  priority?: string;
  criticidade?: string;
  owner_name?: string;
  assigned_user_id?: string;
  assigned_user?: { id: string, name: string, email: string };
  due_at?: string;
  alertops_alert?: AlertopsAlert;
  created_at: string;
  labels?: CardLabel[];
  checklist_done_count?: number;
  group_id?: string;
  group?: AlertGroup;
  _count?: {
    checklists: number;
    comments: number;
  };
}

export interface CardLabel {
  id: string;
  card_id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  card_id: string;
  title: string;
  is_done: boolean;
  position: number;
}
