// Centralized API base URL for frontend requests
// Priority: VITE_BACKEND_URL env -> localhost for dev -> production default
const DEFAULT_BACKEND = 'https://coldconnect-putf.onrender.com';

const inferLocalhost = () => {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return undefined;
};

export const API_BASE = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  inferLocalhost() ||
  DEFAULT_BACKEND
).replace(/\/$/, '');
