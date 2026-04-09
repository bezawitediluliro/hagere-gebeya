import axios from 'axios';

const tg = window.Telegram?.WebApp;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
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

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  vendors: (params) => api.get('/admin/vendors', { params }),
  updateVendor: (id, data) => api.patch(`/admin/vendors/${id}`, data),
  orders: (params) => api.get('/admin/orders', { params }),
  updateOrderStatus: (id, status) => api.patch(`/admin/orders/${id}/status`, { status }),
  users: (params) => api.get('/admin/users', { params }),
  updateUserRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  discounts: () => api.get('/admin/discounts'),
  createDiscount: (data) => api.post('/admin/discounts', data),
  deleteDiscount: (id) => api.delete(`/admin/discounts/${id}`),
  broadcast: (message) => api.post('/admin/broadcast', { message }),
};
