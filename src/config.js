import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nylas: {
    apiKey: process.env.NYLAS_API_KEY,
    apiUrl: process.env.NYLAS_API_URL || 'https://api.nylas.com',
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET,
  },
  ngrok: {
    authtoken: process.env.NGROK_AUTHTOKEN,
    domain: process.env.NGROK_DOMAIN,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

// Validate required environment variables
if (!config.nylas.apiKey) {
  console.warn('Warning: NYLAS_API_KEY is not set. Please add it to your .env file.');
}

