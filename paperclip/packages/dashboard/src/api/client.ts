const BASE_URL = '/api';
const TOKEN_KEY = 'paperclip_jwt';

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });
  if (res.status === 401) {
    clearAuthToken();
    window.location.reload();
    throw new Error('認証が必要です');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Trading types (aligned with backend field names)
export interface Customer {
  id: string;
  name: string;
  nameKana: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  nameKorean: string | null;
  country: string;
  tier: number;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  equipmentCategories: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  name: string;
  nameJa: string | null;
  manufacturerId: string | null;
  categoryId: string | null;
  specs: Record<string, unknown>;
  priceRange: string | null;
  leadTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'contract' | 'delivery' | 'installation' | 'complete' | 'as';

export interface Deal {
  id: string;
  title: string;
  customerId: string;
  manufacturerId: string | null;
  stage: DealStage;
  amount: number | null;
  probability: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  placeholders: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  templateId: string;
  dealId?: string;
  title: string;
  content: string;
  pdfPath?: string;
  createdAt: string;
}

export interface Email {
  id: string;
  dealId: string | null;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: unknown[];
  messageId?: string;
  receivedAt?: string;
  sentAt?: string;
}

export interface ProposalItem {
  id: string;
  equipmentName: string;
  equipmentNameKo?: string;
  quantity: number;
  unitPrice: number;
  marginRate: number;
  marginInclusivePrice: number;
  subtotal: number;
  manufacturerSpecs?: Record<string, string>;
  translatedSpecs?: Record<string, string>;
}

export interface Proposal {
  id: string;
  dealId: string;
  customerId: string;
  manufacturerId: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  items: ProposalItem[];
  deliveryTerms?: string;
  paymentTerms?: string;
  validityDays?: number;
  notes?: string;
  totalAmount: number;
  pdfPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentListItem {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  status: string;
  budgetLimit: number;
  budgetUsed: number;
  currentTaskId: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string;
  budgetAllocated: number;
  budgetUsed: number;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationItem {
  id: string;
  taskId: string;
  reason: string;
  urgency: string;
  channel: string;
  status: string;
  createdAt: string;
}

export interface ImprovementMetric {
  agentId: string;
  completionTimes: { timestamp: string; value: number }[];
  successRates: { timestamp: string; value: number }[];
  costEfficiency: { timestamp: string; value: number }[];
}

export interface BudgetInfo {
  agentId: string;
  limit: number;
  spent: number;
  remaining: number;
}

export interface ThresholdItem {
  id: string;
  dimension: string;
  value: number;
  timeoutMs: number;
  timeoutAction: string;
  scope: string;
}

export async function login(username: string, password: string): Promise<{ success: boolean; token?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? 'ログインに失敗しました');
    }
    const data = await res.json() as { token: string };
    setAuthToken(data.token);
    return { success: true, token: data.token };
  } catch (err) {
    return { success: false };
  }
}

export async function refreshToken(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json() as { token: string };
    setAuthToken(data.token);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  getAgents: () =>
    request<{ agents: AgentListItem[]; total: number }>('/agents'),

  getTasks: (filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return request<{ tasks: TaskItem[]; total: number }>(`/tasks${params}`);
  },

  createTask: (data: {
    title: string;
    description: string;
    priority: number;
    budgetAllocated?: number;
    assigneeId?: string;
  }) =>
    request<{ task: TaskItem }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTask: (id: string) =>
    request<{ task: TaskItem }>(`/tasks/${id}`),

  getApprovals: () =>
    request<{ escalations: EscalationItem[] }>('/approvals'),

  approveEscalation: (id: string) =>
    request<{ success: boolean; escalation: unknown }>(`/approvals/${id}/approve`, {
      method: 'POST',
    }),

  rejectEscalation: (id: string) =>
    request<{ success: boolean; escalation: unknown }>(`/approvals/${id}/reject`, {
      method: 'POST',
    }),

  getImprovementMetrics: () =>
    request<ImprovementMetric[]>('/metrics/improvement'),

  getBudget: () =>
    request<BudgetInfo[]>('/budget'),

  getThresholds: () =>
    request<{ thresholds: ThresholdItem[] }>('/settings/thresholds'),

  updateThresholds: (threshold: ThresholdItem) =>
    request<{ success: boolean }>('/settings/thresholds', {
      method: 'PUT',
      body: JSON.stringify(threshold),
    }),

  trading: {
    // Customers
    getCustomers: () => request<{ customers: Customer[] }>('/trading/customers').then(r => r.customers),
    createCustomer: (data: Record<string, unknown>) => request<{ customer: Customer }>('/trading/customers', { method: 'POST', body: JSON.stringify(data) }).then(r => r.customer),
    updateCustomer: (id: string, data: Record<string, unknown>) => request<{ customer: Customer }>(`/trading/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.customer),
    deleteCustomer: (id: string) => request<void>(`/trading/customers/${id}`, { method: 'DELETE' }),

    // Manufacturers
    getManufacturers: (filters?: Record<string, string>) => request<{ manufacturers: Manufacturer[] }>(`/trading/manufacturers${filters ? '?' + new URLSearchParams(filters) : ''}`).then(r => r.manufacturers),
    createManufacturer: (data: Record<string, unknown>) => request<{ manufacturer: Manufacturer }>('/trading/manufacturers', { method: 'POST', body: JSON.stringify(data) }).then(r => r.manufacturer),
    updateManufacturer: (id: string, data: Record<string, unknown>) => request<{ manufacturer: Manufacturer }>(`/trading/manufacturers/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.manufacturer),
    deleteManufacturer: (id: string) => request<void>(`/trading/manufacturers/${id}`, { method: 'DELETE' }),

    // Equipment
    getEquipment: (filters?: Record<string, string>) => request<{ equipment: Equipment[] }>(`/trading/equipment${filters ? '?' + new URLSearchParams(filters) : ''}`).then(r => r.equipment),
    createEquipment: (data: Record<string, unknown>) => request<{ equipment: Equipment }>('/trading/equipment', { method: 'POST', body: JSON.stringify(data) }).then(r => r.equipment),
    updateEquipment: (id: string, data: Record<string, unknown>) => request<{ equipment: Equipment }>(`/trading/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.equipment),
    deleteEquipment: (id: string) => request<void>(`/trading/equipment/${id}`, { method: 'DELETE' }),

    // Deals
    getDeals: (filters?: Record<string, string>) => request<{ deals: Deal[] }>(`/trading/deals${filters ? '?' + new URLSearchParams(filters) : ''}`).then(r => r.deals),
    createDeal: (data: Record<string, unknown>) => request<{ deal: Deal }>('/trading/deals', { method: 'POST', body: JSON.stringify(data) }).then(r => r.deal),
    getDeal: (id: string) => request<{ deal: Deal }>(`/trading/deals/${id}`).then(r => r.deal),
    updateDeal: (id: string, data: Record<string, unknown>) => request<{ deal: Deal }>(`/trading/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.deal),
    advanceDeal: (id: string) => request<{ deal: Deal }>(`/trading/deals/${id}/advance`, { method: 'POST' }).then(r => r.deal),

    // Templates & Documents
    getTemplates: (category?: string) => request<{ templates: Template[] }>(`/trading/templates${category ? '?category=' + category : ''}`).then(r => r.templates),
    getTemplate: (id: string) => request<{ template: Template }>(`/trading/templates/${id}`).then(r => r.template),
    createDocument: (data: Record<string, unknown>) => request<{ document: Document }>('/trading/documents', { method: 'POST', body: JSON.stringify(data) }).then(r => r.document),
    getDocument: (id: string) => request<{ document: Document }>(`/trading/documents/${id}`).then(r => r.document),
    getDocumentPdf: (id: string) => fetch(`${BASE_URL}/trading/documents/${id}/pdf`),

    // Email
    getDealEmails: (dealId: string) => request<{ emails: Email[] }>(`/trading/deals/${dealId}/emails`).then(r => r.emails),
    sendDealEmail: (dealId: string, data: Record<string, unknown>) => request<void>(`/trading/deals/${dealId}/emails`, { method: 'POST', body: JSON.stringify(data) }),

    // Proposals
    getProposal: (id: string) => request<{ proposal: Proposal }>(`/trading/proposals/${id}`).then(r => r.proposal),
    updateProposal: (id: string, data: Record<string, unknown>) => request<{ proposal: Proposal }>(`/trading/proposals/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.proposal),
    approveProposal: (id: string) => request<{ proposal: Proposal }>(`/trading/proposals/${id}/approve`, { method: 'POST' }).then(r => r.proposal),
    rejectProposal: (id: string) => request<{ proposal: Proposal }>(`/trading/proposals/${id}/reject`, { method: 'POST' }).then(r => r.proposal),
    getProposalPdf: (id: string) => fetch(`${BASE_URL}/trading/proposals/${id}/pdf`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }),
  },
};
