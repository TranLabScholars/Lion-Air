// ─────────────────────────────────────────────────────────────
//  The ONLY file you need to edit to point the app at a sensor.
// ─────────────────────────────────────────────────────────────

// Replace with your PurpleAir sensor index (the number in the PurpleAir map URL).
export const SENSOR_INDEX = process.env.REACT_APP_SENSOR_INDEX;

// Only needed for PRIVATE sensors. Leave empty for public ones.
export const SENSOR_READ_KEY = process.env.REACT_APP_SENSOR_READ_KEY;

// PurpleAir READ API key (https://develop.purpleair.com).
// Put it in a .env file as REACT_APP_PURPLEAIR_API_KEY=xxxx and restart `npm start`.
// NOTE: anything in a React app is visible in the browser, so this is fine for a
// demo but move it behind your backend before going public.
export const API_KEY = process.env.REACT_APP_PURPLEAIR_API_KEY || '';

export const API_BASE = 'https://api.purpleair.com/v1';

// Optional: when set, registrations are ALSO POSTed to `${BACKEND_URL}/api/sensors/register`.
// Leave empty to keep everything in the browser (localStorage).
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// With no API key the app runs on realistic simulated data so you can still demo.
export const USE_MOCK = !API_KEY;

// How often the dashboard refreshes (ms). PurpleAir rate-limits, so don't go too low.
export const POLL_MS = 2 * 60 * 1000;
