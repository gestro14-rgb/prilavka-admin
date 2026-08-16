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

/**
 * Загрузка файла сторис (видео/обложка) — через наш бэкенд, который
 * потоком перекладывает файл в S3 и возвращает публичный URL.
 *
 * Не напрямую в S3 по presigned-ссылке, хотя такая ручка на бэкенде есть:
 * Selectel не отдаёт CORS-заголовки на запись и отвечает на preflight
 * отказом, как только в URL появляются presigned-параметры, поэтому
 * браузер блокирует PUT ещё до отправки. Проверено на живом бакете, см.
 * комментарий в prilavka-backend/s3.js.
 *
 * XMLHttpRequest, а не fetch: только у XHR есть upload.onprogress —
 * fetch не умеет отдавать прогресс ОТПРАВКИ, а для видео на десятки
 * мегабайт индикатор обязателен.
 *
 * onProgress получает 0..100 или null, если размер неизвестен.
 */
// Должно совпадать с STORY_UPLOAD_MAX_BYTES на бэкенде. Проверяем и здесь:
// сервер, отвергая слишком большой файл, вынужден оборвать приём на
// середине, и до браузера аккуратный JSON-ответ уже не всегда доходит —
// пользователь видел бы обрыв связи вместо внятной причины.
export const STORY_UPLOAD_MAX_MB = 200;

export async function uploadStoryFile(file, kind, onProgress) {
  if (file.size > STORY_UPLOAD_MAX_MB * 1024 * 1024) {
    throw new Error(
      `Файл ${(file.size / 1024 / 1024).toFixed(0)} МБ — больше лимита ${STORY_UPLOAD_MAX_MB} МБ`
    );
  }

  const form = new FormData();
  form.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/admin/story-cards/upload?kind=${encodeURIComponent(kind)}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    // Content-Type не выставляем вручную: браузер сам добавит его вместе с
    // boundary для FormData, без которого multipart не разобрать.
    xhr.upload.onprogress = (e) => {
      if (typeof onProgress === 'function') {
        onProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : null);
      }
    };
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* не JSON — обработаем ниже */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) {
        resolve(body.url);
      } else {
        reject(new Error(body?.error || `Загрузка не удалась (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Не удалось связаться с сервером — проверьте соединение'));
    xhr.send(form);
  });
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
  // order — массив id категорий в желаемом порядке (все существующие,
  // ровно по одному разу); бэкенд перезаписывает sort_order целиком.
  reorderCategories: (order) =>
    request('/api/admin/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ order }),
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
  updateDelivery: (id, data) =>
    request(`/api/admin/deliveries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDelivery: (id) =>
    request(`/api/admin/deliveries/${id}`, {
      method: 'DELETE',
    }),

  // Ручные подборки товаров для витрин Главной ("Хиты недели" /
  // "Сейчас в сезоне") — shelf: 'hits' | 'seasonal'.
  getHomeShelf: (shelf) => request(`/api/admin/home-shelves?shelf=${encodeURIComponent(shelf)}`),
  addToHomeShelf: (data) =>
    request('/api/admin/home-shelves', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateHomeShelfItem: (id, data) =>
    request(`/api/admin/home-shelves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  removeFromHomeShelf: (id) =>
    request(`/api/admin/home-shelves/${id}`, {
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

  // /api/ui-icons публичный (его же читает prilavka-app), запись — только
  // через /api/admin/ui-icons/:key.
  getUiIcons: () => request('/api/ui-icons'),
  updateUiIcon: (key, imageUrl) =>
    request(`/api/admin/ui-icons/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ imageUrl }),
    }),

  getPricingSettings: () => request('/api/admin/pricing-settings'),
  updatePricingSettings: (data) =>
    request('/api/admin/pricing-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
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

  // Сторис-карточки Главной. Файлы грузятся не здесь, а через
  // uploadStoryFile выше (напрямую в S3) — сюда попадает только готовый URL.
  getStoryCards: () => request('/api/admin/story-cards'),
  createStoryCard: (data) =>
    request('/api/admin/story-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStoryCard: (id, data) =>
    request(`/api/admin/story-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteStoryCard: (id) =>
    request(`/api/admin/story-cards/${id}`, {
      method: 'DELETE',
    }),

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
