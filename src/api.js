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
    // Некоторые ручки (например, удаление подкатегории с привязанными
    // товарами) возвращают структурированную ошибку, которую вызывающий код
    // должен прочитать (например, чтобы показать точное число товаров в
    // диалоге подтверждения) — не только текстовое сообщение.
    const message = body?.error || `Ошибка запроса: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/api/admin/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Ошибка загрузки изображения');
  }
  return (await res.json()).url;
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

  getSubcategories: () => request('/api/admin/subcategories'),
  createSubcategory: (data) =>
    request('/api/admin/subcategories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSubcategory: (id, data) =>
    request(`/api/admin/subcategories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  // force: true — подтверждённое удаление, даже если к подкатегории привязаны
  // товары (их subcategory_id станет NULL). Без force бэкенд вернёт 409 с
  // { error: 'has_products', count } вместо удаления.
  deleteSubcategory: (id, { force = false } = {}) =>
    request(`/api/admin/subcategories/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' }),

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

  getSettings: () => request('/api/admin/settings'),
  updateSetting: (key, value) =>
    request(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  getStats: () => request('/api/admin/stats'),

  getAnalyticsFunnel: ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request(`/api/admin/analytics/funnel?${params}`);
  },
  getAnalyticsTopScreens: ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request(`/api/admin/analytics/top-screens?${params}`);
  },
  getAnalyticsSessions: ({ from, to, userId } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (userId) params.set('user_id', userId);
    return request(`/api/admin/analytics/sessions?${params}`);
  },
  getAnalyticsSession: (sessionId) => request(`/api/admin/analytics/sessions/${encodeURIComponent(sessionId)}`),

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
