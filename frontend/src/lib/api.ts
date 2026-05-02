import { useAuthStore } from './store';

const BASE = '/api/v1';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }
  }
  return res;
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),

  // Keys
  listKeys: () => request('/keys'),
  createKey: (data: { name: string; rate_limit_rpm?: number; expires_in_days?: number; model_ids?: string[] }) =>
    request('/keys', { method: 'POST', body: JSON.stringify(data) }),
  deleteKey: (id: string) => request(`/keys/${id}`, { method: 'DELETE' }),
  toggleKey: (id: string) => request(`/keys/${id}/toggle`, { method: 'PATCH' }),
  testKey: (id: string, message?: string) =>
    request(`/keys/${id}/test`, { method: 'POST', body: JSON.stringify({ message: message || 'Hi' }) }),
  updateKeyModels: (id: string, model_ids: string[]) =>
    request(`/keys/${id}/models`, { method: 'PUT', body: JSON.stringify({ model_ids }) }),

  // Models
  listModels: () => request('/models'),

  // Usage
  getUsageLogs: (days = 7, limit = 50, offset = 0) =>
    request(`/usage/logs?days=${days}&limit=${limit}&offset=${offset}`),
  getUsageStats: (days = 7) => request(`/usage/stats?days=${days}`),
  getUsageSummary: (days = 1) => request(`/usage/summary?days=${days}`),

  // Billing
  getBalance: () => request('/billing/balance'),
  recharge: (amount: number) =>
    request('/billing/recharge', { method: 'POST', body: JSON.stringify({ amount, payment_method: 'manual' }) }),
  getTransactions: (limit = 50, offset = 0) =>
    request(`/billing/transactions?limit=${limit}&offset=${offset}`),

  // Admin
  adminUsers: () => request('/admin/users'),
  adminStats: () => request('/admin/stats'),
  adminAddModel: (data: { provider: string; model_name: string; display_name: string; base_url: string; api_key: string; pricing_input: number; pricing_output: number; max_tokens_limit: number }) =>
    request('/admin/models', { method: 'POST', body: JSON.stringify(data) }),
  adminToggleModel: (id: string) => request(`/admin/models/${id}/toggle`, { method: 'PATCH' }),
  adminDeleteModel: (id: string) => request(`/admin/models/${id}`, { method: 'DELETE' }),
  adminGetModel: (id: string) => request(`/admin/models/${id}`),
  adminUpdateModel: (id: string, data: Record<string, unknown>) =>
    request(`/admin/models/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
