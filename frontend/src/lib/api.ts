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

  // Feedback
  createFeedback: (data: { content: string; category?: string }) =>
    request('/feedback', { method: 'POST', body: JSON.stringify(data) }),
  listMyFeedback: (limit = 20, offset = 0) =>
    request(`/feedback?limit=${limit}&offset=${offset}`),
  deleteFeedback: (id: string) =>
    request(`/feedback/${id}`, { method: 'DELETE' }),
  // Admin feedback
  adminListFeedback: (limit = 50, offset = 0) =>
    request(`/admin/feedback?limit=${limit}&offset=${offset}`),
  adminReplyFeedback: (id: string, reply: string) =>
    request(`/admin/feedback/${id}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }),
  listPublicFeedback: (limit = 20, offset = 0) =>
    fetch(`/api/v1/public/feedback?limit=${limit}&offset=${offset}`).then(r => r.json()),

  // AI News
  listNews: (limit = 20, offset = 0, category?: string) =>
    fetch(`/api/v1/public/news?limit=${limit}&offset=${offset}${category ? `&category=${encodeURIComponent(category)}` : ''}`).then(r => r.json()),
  adminListNews: (limit = 20, offset = 0, publishedOnly = false) =>
    request(`/admin/news?limit=${limit}&offset=${offset}&published_only=${publishedOnly}`),
  adminCreateNews: (data: { title: string; summary: string; content?: string; category: string; source_name: string; source_url?: string; is_published: boolean }) =>
    request('/admin/news', { method: 'POST', body: JSON.stringify(data) }),
  adminUpdateNews: (id: string, data: Record<string, unknown>) =>
    request(`/admin/news/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminGetNews: (id: string) => request(`/admin/news/${id}`),
  adminDeleteNews: (id: string) =>
    request(`/admin/news/${id}`, { method: 'DELETE' }),
  autoFetchNews: () => request('/admin/news/auto-fetch', { method: 'POST' }),
  adminSendNewsToUser: (newsId: string, userId: string, encrypted?: string) =>
    request(`/admin/news/${newsId}/send`, { method: 'POST', body: JSON.stringify({ user_id: userId, ...(encrypted ? { encrypted } : {}) }) }),
  adminEncryptNews: (newsId: string, password: string) =>
    request(`/admin/news/${newsId}/encrypt`, { method: 'POST', body: JSON.stringify({ password }) }),
  listRssSources: () => request('/admin/news/auto-fetch/sources'),
  getNewsSettings: () => request('/admin/news/settings'),
  updateNewsSettings: (data: { fetch_count?: number; fetch_hour?: number; fetch_minute?: number }) =>
    request('/admin/news/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin
  adminUsers: () => request('/admin/users'),
  adminDeleteUser: (id: string) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  adminStats: () => request('/admin/stats'),
  adminAddModel: (data: { provider: string; model_name: string; display_name: string; base_url: string; api_key: string; pricing_input: number; pricing_output: number; max_tokens_limit: number }) =>
    request('/admin/models', { method: 'POST', body: JSON.stringify(data) }),
  adminToggleModel: (id: string) => request(`/admin/models/${id}/toggle`, { method: 'PATCH' }),
  adminDeleteModel: (id: string) => request(`/admin/models/${id}`, { method: 'DELETE' }),
  adminGetModel: (id: string) => request(`/admin/models/${id}`),
  adminUpdateModel: (id: string, data: Record<string, unknown>) =>
    request(`/admin/models/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Digest (admin SMTP)
  getSmtpSettings: () => request('/admin/digest'),
  updateSmtpSettings: (data: Record<string, unknown>) =>
    request('/admin/digest', { method: 'PATCH', body: JSON.stringify(data) }),
  sendTestEmail: (email: string) =>
    request(`/admin/digest/test?recipient_email=${encodeURIComponent(email)}`, { method: 'POST' }),

  // Digest (user)
  getMyDigestPref: () => request('/digest'),
  updateMyDigestPref: (data: Record<string, unknown>) =>
    request('/digest', { method: 'PATCH', body: JSON.stringify(data) }),

  // Battle
  getBattleHistory: (limit = 20, offset = 0) =>
    request(`/battle/history?limit=${limit}&offset=${offset}`),
  getBattleDetail: (id: string) => request(`/battle/history/${id}`),

  // Hub content (admin)
  adminGetHubContent: () => request('/admin/hub/content'),
  adminUpdateHubContent: (key: string, data: { title?: string; content?: string }) =>
    request(`/admin/hub/content/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
};
