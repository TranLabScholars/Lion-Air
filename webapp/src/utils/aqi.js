// US EPA PM2.5 AQI (2024 breakpoints)
const BREAKPOINTS = [
  [0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 400],
  [325.5, 500.4, 401, 500],
];

export const CATEGORIES = [
  { max: 50, label: 'Good', color: '#2f9e44', advice: 'Air quality is satisfactory.' },
  { max: 100, label: 'Moderate', color: '#e0a800', advice: 'Unusually sensitive people should consider limiting long outdoor exertion.' },
  { max: 150, label: 'Unhealthy for sensitive groups', color: '#f08c00', advice: 'Children, older adults and people with lung or heart disease should reduce outdoor exertion.' },
  { max: 200, label: 'Unhealthy', color: '#e03131', advice: 'Health alert!' },
  { max: 300, label: 'Very unhealthy', color: '#8f3f97', advice: 'Health alert!' },
  { max: Infinity, label: 'Hazardous', color: '#7e0023', advice: 'Health alert!' },
];

export function aqiFromPm25(pm) {
  if (pm === null || pm === undefined || Number.isNaN(Number(pm))) return null;
  const c = Math.floor(Number(pm) * 10) / 10;
  const [cLo, cHi, iLo, iHi] =
    BREAKPOINTS.find(([lo, hi]) => c >= lo && c <= hi) ||
    BREAKPOINTS[BREAKPOINTS.length - 1];
  return Math.round(((iHi - iLo) / (cHi - cLo)) * (Math.min(c, cHi) - cLo) + iLo);
}

export function categoryFor(aqi) {
  if (aqi === null) return { label: 'No data', color: '#868e96', advice: 'Waiting for sensor data.' };
  return CATEGORIES.find((c) => aqi <= c.max);
}
