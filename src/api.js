// API-клиент для админ-панели "Прилавка"

// URL бэкенда задаётся через переменную окружения VITE_API_URL при сборке.
// Для локальной разработки по умолчанию используется localhost:3001.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TOKEN_KEY = 'prilavka_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
  }

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || `Ошибка запроса: ${res.status}`;
    throw new Error(message);
  }

  return body;
}

export const api = {
  login: (username, password) =>
    request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request('/api/admin/me'),

  getProducts: () => request('/api/admin/products'),
  getProduct: (id) => request(`/api/admin/products/${id}`),
  createProduct: (data) =>
    request('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id, data) =>
    request(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id) =>
    request(`/api/admin/products/${id}`, {
      method: 'DELETE',
    }),

  getCategories: () => request('/api/admin/categories'),
  createCategory: (data) =>
    request('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id) =>
    request(`/api/admin/categories/${id}`, {
      method: 'DELETE',
    }),

  getDistricts: () => request('/api/admin/districts'),
  createDistrict: (data) =>
    request('/api/admin/districts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDistrict: (id) =>
    request(`/api/admin/districts/${id}`, { method: 'DELETE' }),

  getDeliveryZones: () => request('/api/admin/delivery-zones'),
  createDeliveryZone: (data) =>
    request('/api/admin/delivery-zones', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDeliveryZone: (id, data) =>
    request(`/api/admin/delivery-zones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDeliveryZone: (id) =>
    request(`/api/admin/delivery-zones/${id}`, {
      method: 'DELETE',
    }),

  getOrders: () => request('/api/admin/orders'),
  updateOrder: (id, data) =>
    request(`/api/admin/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getPromoCodes: () => request('/api/admin/promo-codes'),
  createPromoCode: (data) =>
    request('/api/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deletePromoCode: (id) =>
    request(`/api/admin/promo-codes/${id}`, {
      method: 'DELETE',
    }),

  getUsers: () => request('/api/admin/users'),
  adjustUserPoints: (telegramId, delta) =>
    request(`/api/admin/users/${telegramId}/points`, {
      method: 'PATCH',
      body: JSON.stringify({ delta }),
    }),

  getReviews: () => request('/api/admin/reviews'),
  createReview: (data) =>
    request('/api/admin/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteReview: (id) =>
    request(`/api/admin/reviews/${id}`, {
      method: 'DELETE',
    }),
  publishReview: (id) =>
    request(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
    }),

  getDeliveries: () => request('/api/admin/deliveries'),
  createDelivery: (data) =>
    request('/api/admin/deliveries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDelivery: (id) =>
    request(`/api/admin/deliveries/${id}`, {
      method: 'DELETE',
    }),

  getBundleComposition: (productId) =>
    request(`/api/admin/products/${productId}/composition`),
  addBundleItem: (productId, data) =>
    request(`/api/admin/products/${productId}/composition`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateBundleItem: (productId, itemId, data) =>
    request(`/api/admin/products/${productId}/composition/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteBundleItem: (productId, itemId) =>
    request(`/api/admin/products/${productId}/composition/${itemId}`, {
      method: 'DELETE',
    }),

  getStats: () => request('/api/admin/stats'),

  getDeliverySchedule: () => request('/api/admin/delivery-schedule'),
  upsertDeliverySchedule: (data) =>
    request('/api/admin/delivery-schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDeliverySchedule: (id) =>
    request(`/api/admin/delivery-schedule/${id}`, { method: 'DELETE' }),

  getRewards: () => request('/api/admin/rewards'),
  createReward: (data) =>
    request('/api/admin/rewards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateReward: (id, data) =>
    request(`/api/admin/rewards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteReward: (id) =>
    request(`/api/admin/rewards/${id}`, {
      method: 'DELETE',
    }),
};
