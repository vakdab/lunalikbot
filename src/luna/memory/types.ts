export interface Mem0Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Mem0MemoryItem {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  hash?: string;
  metadata?: {
    category?: 'preference' | 'biography' | 'emotion' | 'milestone' | 'habit';
    sentiment?: 'positive' | 'neutral' | 'negative';
    intimacy_level?: number;
    timestamp?: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

export interface Mem0SearchOptions {
  query: string;
  userId: number | string;
  agentId?: string;
  limit?: number;
  threshold?: number;
  categories?: string[];
}

export interface Mem0AddOptions {
  messages: Mem0Message[];
  userId: number | string;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface Mem0HistoryItem {
  id: string;
  memory_id: string;
  old_memory?: string;
  new_memory?: string;
  event: 'ADD' | 'UPDATE' | 'DELETE';
  created_at: string;
}
