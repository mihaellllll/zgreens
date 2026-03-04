import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ─── Simple in-memory GET cache ───────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL = 5_000;  // 5 sekundi (lokalna baza, nema latencije)

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

const _origGet = api.get.bind(api);
api.get = function cachedGet(url, config) {
  const now = Date.now();
  const entry = _cache.get(url);
  if (entry && now - entry.ts < CACHE_TTL) {
    return Promise.resolve(entry.res);
  }
  return _origGet(url, config).then(res => {
    _cache.set(url, { res, ts: now });
    return res;
  });
};

// Call this after mutations to force a fresh fetch on next GET
export function invalidateCache(prefix) {
  for (const key of _cache.keys()) {
    if (!prefix || key.startsWith(prefix)) _cache.delete(key);
  }
}

export default api;
