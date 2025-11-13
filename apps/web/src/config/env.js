/**
 * Environment configuration utility
 * Centralizes access to environment variables and provides environment flags
 */

// Get the USE_MOCK_DATA flag from environment variable
// Defaults to true in development mode, false in production
const getUseMockData = () => {
  const envValue = import.meta.env.VITE_USE_MOCK_DATA;
  
  // If explicitly set, use that value
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === true;
  }
  
  // Otherwise, default based on mode
  return import.meta.env.MODE === 'development';
};

export const USE_MOCK_DATA = getUseMockData();
export const IS_DEVELOPMENT = import.meta.env.MODE === 'development';
export const IS_PRODUCTION = import.meta.env.MODE === 'production';

