// Only needed for PRIVATE sensors
export const SENSOR_READ_KEY = process.env.REACT_APP_SENSOR_READ_KEY;
export const SENSOR_LOCATION = process.env.REACT_APP_SENSOR_LOCATION || '';

export const API_KEY = process.env.REACT_APP_PURPLEAIR_API_KEY || '';

export const API_BASE = 'https://api.purpleair.com/v1';

// For sensor management
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
export const USE_MOCK = !API_KEY;
export const POLL_MS = 2 * 60 * 1000;
