export interface KpiCardItem {
  title: string;
  value: string;
  sub_label?: string;
  trend?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'blue';
}

export interface Kpis {
  gmv: string;
  orders: string;
  aov: string;
  gmv_growth?: string;
  domain?: 'schema' | 'sales' | 'general';
  cards?: KpiCardItem[];
}

export interface SandboxMeta {
  is_safe: boolean;
  dialect: string;
  limit_injected: boolean;
  max_rows: number;
}

export interface ChartMeta {
  x_index: number;
  x_column: string;
  y_index: number;
  y_column: string;
}

export interface QueryResponse {
  success: boolean;
  session_id?: string;
  prompt: string;
  safe_sql: string;
  sandbox_meta: SandboxMeta;
  duration_ms: number;
  columns: string[];
  rows: (string | number | null)[][];
  row_count: number;
  kpis: Kpis;
  chart_meta?: ChartMeta;
  summary: string;
}

export interface ReportBlockData extends Partial<QueryResponse> {
  id: string;
  sessionId?: string;
  createdAt: string;
  title: string;
  prompt: string;
  status?: 'success' | 'error';
  errorMessage?: string;
  errorDetails?: string;
  rawSql?: string;
  archived?: boolean;
  downloadUrl?: string;
  fileName?: string;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
}

export interface DatabaseSchema {
  tables: string[];
  schema: Record<string, TableColumn[]>;
  connection_url: string;
  recommended_prompts?: string[];
}

export interface DatabasePreset {
  id?: string;
  name: string;
  type: 'sqlite' | 'mysql' | 'postgresql';
  masked_url: string;
  description: string;
  is_preset?: boolean;
}

export interface User {
  id: number;
  username: string;
  nickname: string;
  role: string;
  created_at: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  datasource_name: string;
  message_count: number;
  last_prompt: string;
  updated_at: string;
  created_at: string;
}

export interface UserReportItem {
  id?: number;
  file_name: string;
  title: string;
  summary?: string;
  size_bytes: number;
  download_url: string;
  created_at?: string;
  updated_at?: string;
}
