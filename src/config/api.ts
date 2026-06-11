/** Base URL API (ex. `/api/v1` ou URL absolue en prod). */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
