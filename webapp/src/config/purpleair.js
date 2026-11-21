// Spring backend URL (where the Purple Air key lives)
export const BACKEND_URL = (
  process.env.REACT_APP_BACKEND_URL
  ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080')
).replace(/\/+$/, '');

// Polling rate for the sensors
export const POLL_MS = Number(process.env.REACT_APP_POLL_MS) || 60000;
