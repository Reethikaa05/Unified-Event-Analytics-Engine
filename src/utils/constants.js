module.exports = {
  // API Key constants
  API_KEY_LENGTH: 32,
  API_KEY_EXPIRY_DAYS: 365,

  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  },

  // Cache TTL in seconds
  CACHE_TTL: {
    EVENT_SUMMARY: 300,    // 5 minutes
    USER_STATS: 120,       // 2 minutes
    GENERAL: 600           // 10 minutes
  },

  // Event types
  EVENT_TYPES: {
    PAGE_VIEW: 'page_view',
    CLICK: 'click',
    FORM_SUBMIT: 'form_submit',
    CUSTOM: 'custom'
  },

  // Device types
  DEVICE_TYPES: {
    MOBILE: 'mobile',
    DESKTOP: 'desktop',
    TABLET: 'tablet'
  },

  // HTTP Status codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  }
};