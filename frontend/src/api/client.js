import axios from 'axios';

const tg = window.Telegram?.WebApp;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const initData = tg?.initData || (import.meta.env.DEV ? 'dev' : '');
  if (initData) config.headers['x-telegram-init-data'] = initData;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;

// API helpers
export const vendorsApi = {
  list: (params) => api.get('/vendors', { params }),
  categories: () => api.get('/vendors/categories'),
  get: (id) => api.get(`/vendors/${id}`),
  products: (id, params) => api.get(`/vendors/${id}/products`, { params }),
};

export const productsApi = {
  list: (params) => api.get('/products', { params }),
  categories: () => api.get('/products/categories'),
  get: (id) => api.get(`/products/${id}`),
};

export const cartApi = {
  get: () => api.get('/cart'),
  add: (productId, quantity) => api.post('/cart', { productId, quantity }),
  remove: (productId) => api.delete(`/cart/${productId}`),
  clear: () => api.delete('/cart'),
};

export const ordersApi = {
  list: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  place: (data) => api.post('/orders', data),
};

export const discountsApi = {
  validate: (data) => api.post('/discounts/validate', data),
};

export const userApi = {
  me: () => api.get('/user/me'),
  update: (data) => api.patch('/user/me', data),
  applyVendor: (data) => api.post('/user/vendor-apply', data),
};
