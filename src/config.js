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
};

// Validate required environment variables
if (!config.nylas.apiKey) {
  console.warn('Warning: NYLAS_API_KEY is not set. Please add it to your .env file.');
}

