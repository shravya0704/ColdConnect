// Centralized API base URL for frontend requests
// Priority: VITE_BACKEND_URL env -> default deployed URL
const DEFAULT_BACKEND = 'https://coldconnect-putf.onrender.com';

export const API_BASE = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) || DEFAULT_BACKEND
).replace(/\/$/, '');
