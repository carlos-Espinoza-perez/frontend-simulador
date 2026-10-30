import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const CLIENT_ID_KEY = 'robot_device_client_id';

export function getBrowserClientId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default';
  }
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id || !/^[a-zA-Z0-9_-]{4,64}$/.test(id)) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    try {
      localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {
      return id;
    }
  }
  return id;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};
    config.headers['X-Client-ID'] = getBrowserClientId();
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
