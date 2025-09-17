export const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://34.198.163.51/api',
  APP_NAME: process.env.REACT_APP_NAME || 'Sistema de Inventario',
  VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
  },
  
  DATE_FORMAT: 'DD/MM/YYYY',
  DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
  
  TOAST_DURATION: 3000,
  
  SESSION: {
    TOKEN_KEY: 'token',
    USER_KEY: 'user',
    REFRESH_TOKEN_KEY: 'refreshToken'
  },
  
  ROUTES: {
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    COMPONENTS: '/components',
    MOVEMENTS: '/movements',
    RECIPES: '/recipes',
    REPORTS: '/reports',
    USERS: '/users',
    PROJECTION: '/projection',
    DELIVERIES: '/deliveries'
  }
};

export default config;