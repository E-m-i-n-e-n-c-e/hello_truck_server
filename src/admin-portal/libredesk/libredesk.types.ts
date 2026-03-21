export interface LibredeskAgent {
  id: number;
  type: string;
  first_name: string;
  last_name: string;
  email: string;
  enabled: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibredeskConversation {
  id: number;
  created_at: string;
  updated_at: string;
  uuid: string;
  contact_id: number;
  inbox_id: number;
  status: string;
  status_id: number;
  assigned_user_id: number | null;
  subject: string;
  reference_number: string;
  priority?: string | null;
  priority_id?: number | null;
  closed_at?: string | null;
  resolved_at?: string | null;
}

export interface LibredeskConversationAssignedWebhook {
  event: 'conversation.assigned';
  timestamp: string;
  payload: {
    conversation_uuid: string;
    assigned_to: number;
    actor_id: number;
    conversation?: LibredeskConversation;
  };
}

export type LibredeskWebhookPayload = 
  | LibredeskConversationAssignedWebhook
  | { event: string; payload: any; [key: string]: any }; // Catch-all for other events
